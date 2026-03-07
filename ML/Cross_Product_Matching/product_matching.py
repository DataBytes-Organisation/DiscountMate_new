# product_matching.py
# -------------------
# DiscountMate - Cross-store Product Matching / Identity Resolution
#
# - Builds canon strings (brand + item_name/name + size/uom) with spaces preserved
# - Runs per-brand matching (brand blocking) to reduce complexity
# - Uses TF-IDF + NearestNeighbors (cosine) for top-K candidate retrieval
# - Scores candidates using ensemble metrics:
#       CHAR (rapidfuzz token_set_ratio), JACCARD (token overlap), COSINE (tf-idf)
# - Computes two modes:
#       true_match_score  = 0.50*CHAR + 0.25*JACCARD + 0.25*COSINE
#       variant_score     = 0.30*CHAR + 0.20*JACCARD + 0.50*COSINE
# - Accepts based on threshold + margin (best - second)

import re
import argparse
import pandas as pd
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from rapidfuzz import fuzz

import csv
import os

# ----------------------------
# Text cleaning and canon utils
# ----------------------------
def clean(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def safe_join(*parts):
    toks = []
    for p in parts:
        t = clean(p)
        if t and t != "nan":
            toks.append(t)
    return " ".join(toks)

def build_canons(master_df: pd.DataFrame, scraped_df: pd.DataFrame):
    master = master_df.copy()
    scraped = scraped_df.copy()

    # Normalized brand for blocking
    master["brand_clean"] = master["brand"].map(clean)
    scraped["brand_clean"] = scraped["brand"].map(clean)

    # Canon strings (team’s “BRAND + ITEM_NAME + UOM” idea, keeping spaces)
    master["canon"] = master.apply(
        lambda r: safe_join(r.get("brand"), r.get("name"), r.get("size")),
        axis=1
    )
    scraped["canon"] = scraped.apply(
        lambda r: safe_join(r.get("brand"), r.get("item_name"), r.get("approx_item_size"), r.get("base_unit")),
        axis=1
    )
    return master, scraped

# ----------------------------
# Similarity components
# ----------------------------
def token_set(a):
    return set(clean(a).split())

def jaccard(a, b):
    A, B = token_set(a), token_set(b)
    if not A and not B:
        return 0.0
    return len(A & B) / max(1, len(A | B))

# --------------------------------
# Core function: run per-brand block
# --------------------------------
def match_brand_ann_ensemble(
    master: pd.DataFrame,
    scraped: pd.DataFrame,
    brand_clean_value: str,
    *,
    top_k: int = 10,
    # Leader weights
    true_w=(0.50, 0.25, 0.25),     # (CHAR, JACCARD, COSINE)
    variant_w=(0.30, 0.20, 0.50),  # (CHAR, JACCARD, COSINE)
    # Acceptance thresholds/margins
    true_threshold: float = 0.90,
    true_margin: float = 0.05,
    variant_threshold: float = 0.88,
    variant_margin: float = 0.03,
):
    # Block by brand
    master_b = master[master["brand_clean"] == brand_clean_value].copy().reset_index(drop=False)
    scraped_b = scraped[scraped["brand_clean"] == brand_clean_value].copy()

    if len(master_b) < 2 or len(scraped_b) == 0:
        return pd.DataFrame(), {
            "brand_clean": brand_clean_value,
            "master_rows": len(master_b),
            "scraped_rows": len(scraped_b),
            "scored_rows": 0,
            "true_accept_rate": 0.0,
            "variant_accept_rate": 0.0,
            "note": "Insufficient rows for matching."
        }

    # TF-IDF + ANN over master canon
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")
    master_texts = master_b["canon"].tolist()
    X_master = vectorizer.fit_transform(master_texts)

    k_eff = min(top_k, len(master_b))
    ann = NearestNeighbors(n_neighbors=k_eff, metric="cosine")
    ann.fit(X_master)

    # Unpack weights
    t_char, t_jac, t_cos = true_w
    v_char, v_jac, v_cos = variant_w

    rows = []

    for s_idx, s_row in scraped_b.iterrows():
        s_txt = s_row.get("canon", "")
        if not s_txt:
            continue

        q_vec = vectorizer.transform([s_txt])
        distances, idxs = ann.kneighbors(q_vec, n_neighbors=k_eff)

        cos_sims = 1 - distances[0]  # cosine similarity in [0,1]
        candidates = []

        for m_pos, cos_sim in zip(idxs[0], cos_sims):
            m_txt = master_texts[int(m_pos)]

            # Components
            char_sim = fuzz.token_set_ratio(s_txt, m_txt) / 100.0
            jac_sim = jaccard(s_txt, m_txt)

            # Two modes
            true_score = t_char * char_sim + t_jac * jac_sim + t_cos * float(cos_sim)
            var_score  = v_char * char_sim + v_jac * jac_sim + v_cos * float(cos_sim)

            candidates.append({
                "m_pos": int(m_pos),
                "char_sim": float(char_sim),
                "jacc_sim": float(jac_sim),
                "cos_sim": float(cos_sim),
                "true_score": float(true_score),
                "variant_score": float(var_score),
            })

        # Top-2 by each mode
        cand_true = sorted(candidates, key=lambda x: x["true_score"], reverse=True)
        cand_var  = sorted(candidates, key=lambda x: x["variant_score"], reverse=True)

        t1, t2 = cand_true[0], (cand_true[1] if len(cand_true) > 1 else None)
        v1, v2 = cand_var[0],  (cand_var[1]  if len(cand_var)  > 1 else None)

        t_margin = (t1["true_score"] - t2["true_score"]) if t2 else None
        v_margin = (v1["variant_score"] - v2["variant_score"]) if v2 else None

        true_decision = (
            "ACCEPTED" if (t1["true_score"] >= true_threshold and (t2 is None or t_margin >= true_margin))
            else "REJECTED_AMBIGUOUS"
        )
        variant_decision = (
            "ACCEPTED" if (v1["variant_score"] >= variant_threshold and (v2 is None or v_margin >= variant_margin))
            else "REJECTED_AMBIGUOUS"
        )

        rows.append({
            # scraped identifiers
            "scraped_index": s_idx,
            "brand_clean": brand_clean_value,
            "store": s_row.get("store", None),
            "category": s_row.get("category", None),
            "item_name": s_row.get("item_name", None),
            "approx_item_size": s_row.get("approx_item_size", None),
            "scraped_canon": s_txt,

            # TRUE top-2
            "true_decision": true_decision,
            "true_best_score": round(t1["true_score"], 3),
            "true_second_score": round(t2["true_score"], 3) if t2 else None,
            "true_margin": round(t_margin, 3) if t_margin is not None else None,
            "true_best_master_pos": t1["m_pos"],
            "true_second_master_pos": t2["m_pos"] if t2 else None,

            # VARIANT top-2
            "variant_decision": variant_decision,
            "variant_best_score": round(v1["variant_score"], 3),
            "variant_second_score": round(v2["variant_score"], 3) if v2 else None,
            "variant_margin": round(v_margin, 3) if v_margin is not None else None,
            "variant_best_master_pos": v1["m_pos"],
            "variant_second_master_pos": v2["m_pos"] if v2 else None,

            # Component scores for TRUE-best
            "best_char": round(t1["char_sim"], 3),
            "best_jacc": round(t1["jacc_sim"], 3),
            "best_cos":  round(t1["cos_sim"], 3),
        })

    out = pd.DataFrame(rows)

    # Summary
    true_accept = (out["true_decision"] == "ACCEPTED").mean() if len(out) else 0.0
    var_accept  = (out["variant_decision"] == "ACCEPTED").mean() if len(out) else 0.0

    summary = {
        "brand_clean": brand_clean_value,
        "master_rows": int(len(master_b)),
        "scraped_rows": int(len(scraped_b)),
        "scored_rows": int(len(out)),
        "true_accept_rate": round(float(true_accept), 3),
        "variant_accept_rate": round(float(var_accept), 3),
        "note": ""
    }

    # Join master details (best+second for each mode)
    # master_b has original master index in column "index"
    master_for_join = master_b.rename(columns={"index": "master_orig_index"}).copy()

    out = (
        out
        .merge(master_for_join[["canon", "name", "size", "master_orig_index"]],
               left_on="true_best_master_pos", right_index=True, how="left")
        .rename(columns={"name": "true_best_name", "size": "true_best_size", "master_orig_index": "true_best_master_id"})
        .merge(master_for_join[["name", "size", "master_orig_index"]],
               left_on="true_second_master_pos", right_index=True, how="left", suffixes=("", "_true2"))
        .rename(columns={"name_true2": "true_second_name", "size_true2": "true_second_size", "master_orig_index_true2": "true_second_master_id"})
        .merge(master_for_join[["name", "size", "master_orig_index"]],
               left_on="variant_best_master_pos", right_index=True, how="left")
        .rename(columns={"name": "variant_best_name", "size": "variant_best_size", "master_orig_index": "variant_best_master_id"})
        .merge(master_for_join[["name", "size", "master_orig_index"]],
               left_on="variant_second_master_pos", right_index=True, how="left", suffixes=("", "_var2"))
        .rename(columns={"name_var2": "variant_second_name", "size_var2": "variant_second_size", "master_orig_index_var2": "variant_second_master_id"})
    )

    return out, summary


def run_two_mode_matching(
    master_df: pd.DataFrame,
    scraped_df: pd.DataFrame,
    brands=None,
    **kwargs
):
    master, scraped = build_canons(master_df, scraped_df)

    # Default brands: intersection; then take top 10 by scraped frequency
    if brands is None:
        brands = sorted(set(scraped["brand_clean"].unique()) & set(master["brand_clean"].unique()))
        top_counts = scraped["brand_clean"].value_counts()
        brands = [b for b in top_counts.index if b in brands][:10]

    all_out = []
    summaries = []

    for b in brands:
        out_b, sum_b = match_brand_ann_ensemble(master, scraped, b, **kwargs)
        summaries.append(sum_b)
        if len(out_b):
            all_out.append(out_b)

    summary_df = pd.DataFrame(summaries).sort_values("scraped_rows", ascending=False)
    out_df = pd.concat(all_out, ignore_index=True) if all_out else pd.DataFrame()

    return out_df, summary_df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--master_csv", default="Master_Coles_Scrape.csv")
    ap.add_argument("--scraped_csv", default="preprocessed_dataset 2.csv")
    ap.add_argument("--top_k", type=int, default=10)
    ap.add_argument("--top_brands", type=int, default=10)
    ap.add_argument("--out_matches", default="matches_out.csv")
    ap.add_argument("--out_summary", default="matches_summary.csv")
    args = ap.parse_args()

   

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    master_file_path = os.path.join(BASE_DIR, 'data', args.master_csv)
    scarpped_file_path = os.path.join(BASE_DIR, 'data', args.scraped_csv)


    master_df = pd.read_csv(master_file_path)
    scraped_df = pd.read_csv(scarpped_file_path)

    # Run top N brands by scraped frequency (within brand intersection)
    master, scraped = build_canons(master_df, scraped_df)
    brands = sorted(set(scraped["brand_clean"].unique()) & set(master["brand_clean"].unique()))
    top_counts = scraped["brand_clean"].value_counts()
    brands = [b for b in top_counts.index if b in brands][:args.top_brands]

    out_df, summary_df = run_two_mode_matching(
        master_df=master_df,
        scraped_df=scraped_df,
        brands=brands,
        top_k=args.top_k
    )

    print("\n=== Acceptance rates by brand (true vs variant) ===")
    if len(summary_df):
        print(summary_df[["brand_clean", "master_rows", "scraped_rows", "scored_rows", "true_accept_rate", "variant_accept_rate", "note"]]
              .to_string(index=False))
    else:
        print("No brands matched / no rows scored.")

    out_df.to_csv(os.path.join(BASE_DIR, 'result', args.out_matches), index=False)
    summary_df.to_csv(os.path.join(BASE_DIR, 'result', args.out_summary), index=False)
    print(f"\nSaved:\n - {args.out_matches}\n - {args.out_summary}")


if __name__ == "__main__":
    main()

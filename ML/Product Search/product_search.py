# product_search.py
# -----------------
# DiscountMate - Product Search + TF-IDF Keyword Exploration
#
# This script supports:
# 1) Search: given a query, return top-K master products using TF-IDF cosine NN
# 2) Keyword analysis:
#       - top informative terms overall
#       - top terms per category
#       - keyword coverage per category
#       - shared keywords across categories + coverage
#       - top-N categories per keyword by coverage

import re
import argparse
import pandas as pd
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

import os    


# ----------------------------
# Cleaning + canon
# ----------------------------
def clean(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def build_master_canon(master_df: pd.DataFrame, features = ['brand','name','size']) -> pd.Series:
    # Team recommendation: BRAND + NAME + SIZE (keep spaces)
    combined = ""
    for featuer in features:
        combined = combined + master_df[featuer].fillna("") + " "

    return combined.map(clean)

    # return (
    #     master_df["brand"].fillna("") + " " +
    #     master_df["name"].fillna("") + " " +
    #     master_df["size"].fillna("")
    # ).map(clean)

def build_search_index(master_df: pd.DataFrame, *, ngram=(1, 2), min_df=1, stop_words="english"):

    master = master_df.copy().reset_index(drop=True)
    master["canon"] = build_master_canon(master)

    vec = TfidfVectorizer(ngram_range=ngram, min_df=min_df, stop_words=stop_words)
    X = vec.fit_transform(master["canon"].tolist())

    nn = NearestNeighbors(metric="cosine")
    nn.fit(X)
    return master, vec, nn, X

def search_master(master, vec, nn, query: str, top_k: int = 10) -> pd.DataFrame:
    q = clean(query)
    q_vec = vec.transform([q])
    distances, indices = nn.kneighbors(q_vec, n_neighbors=min(top_k, len(master)))
    sims = 1 - distances[0]
    idxs = indices[0]

    out = master.iloc[idxs].copy()
    out["cos_sim"] = sims
    out["master_pos"] = idxs
    keep = [c for c in ["master_pos", "product_id", "name", "brand", "size", "gtin", "cos_sim", "canon"] if c in out.columns]
    return out[keep].sort_values("cos_sim", ascending=False).reset_index(drop=True)


# ----------------------------
# TF-IDF keyword exploration
# ----------------------------
def top_terms_overall(master_df: pd.DataFrame, text_col="canon", top_n=20):
    texts = master_df[text_col].tolist()

    vec = TfidfVectorizer(
        ngram_range=(1, 1),
        min_df=3,
        max_df=0.7,
        stop_words="english"
    )
    X = vec.fit_transform(texts)
    terms = np.array(vec.get_feature_names_out())
    mean_tfidf = X.mean(axis=0).A1

    tfidf_df = pd.DataFrame({"term": terms, "mean_tfidf": mean_tfidf})
    return tfidf_df.sort_values("mean_tfidf", ascending=False).head(top_n).reset_index(drop=True)

def top_terms_per_category(df, category_col, text_col="canon", top_n=3, min_df=1):
    results = []
    for cat, g in df.groupby(category_col):
        texts = g[text_col].tolist()
        if len(texts) < 2:
            continue

        vec = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            min_df=min_df,
            max_df=0.95,
            token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b"
        )
        X = vec.fit_transform(texts)
        terms = np.array(vec.get_feature_names_out())
        scores = X.mean(axis=0).A1

        top_idx = scores.argsort()[::-1][:top_n]
        for i in top_idx:
            results.append({category_col: cat, "keyword": terms[i], "mean_tfidf": round(scores[i], 4)})

    return pd.DataFrame(results)

def reverse_keyword_count(df, category_col, text_col, keywords_df):
    rows = []
    for _, r in keywords_df.iterrows():
        cat = r[category_col]
        kw = r["keyword"]

        subset = df[df[category_col] == cat]
        total = len(subset)
        if total == 0:
            continue

        count = subset[text_col].str.contains(rf"\b{re.escape(kw)}\b", regex=True).sum()
        rows.append({
            category_col: cat,
            "keyword": kw,
            "product_count": int(count),
            "total_products": int(total),
            "coverage_pct": round(100 * count / total, 1)
        })
    return pd.DataFrame(rows)

def shared_keyword_coverage(df, category_col, text_col, keywords_df, min_categories=3, top_categories_per_keyword=3):
    # 1) shared keywords (appearing in >= min_categories categories)
    shared_keywords = (
        keywords_df.groupby("keyword")[category_col]
        .nunique()
        .reset_index(name="num_categories")
        .sort_values("num_categories", ascending=False)
    )
    shared_terms = shared_keywords.loc[shared_keywords["num_categories"] >= min_categories, "keyword"]

    # 2) coverage across all categories for those shared terms
    rows = []
    for kw in shared_terms:
        for cat, g in df.groupby(category_col):
            total = len(g)
            if total == 0:
                continue

            count = g[text_col].str.contains(rf"\b{re.escape(kw)}\b", regex=True).sum()
            if count > 0:
                rows.append({
                    "keyword": kw,
                    "category": cat,
                    "product_count": int(count),
                    "total_products": int(total),
                    "coverage_pct": round(100 * count / total, 1)
                })

    coverage_df = pd.DataFrame(rows)
    if coverage_df.empty:
        return shared_keywords, coverage_df, coverage_df

    # 3) top categories per keyword by coverage
    coverage_df["rank_in_keyword"] = (
        coverage_df.groupby("keyword")["coverage_pct"]
        .rank(method="first", ascending=False)
    )
    topN = (
        coverage_df[coverage_df["rank_in_keyword"] <= top_categories_per_keyword]
        .sort_values(["keyword", "coverage_pct"], ascending=[True, False])
        .reset_index(drop=True)
    )

    return shared_keywords, coverage_df, topN


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--master_csv", default="Master_Coles_Scrape.csv")
    ap.add_argument("--query", default=None)
    ap.add_argument("--top_k", type=int, default=10)
    ap.add_argument("--do_keywords", action="store_true" , default=True)
    ap.add_argument("--category_col", default="merchandise_category")
    args = ap.parse_args()

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    master_file_path = os.path.join(BASE_DIR, 'data', args.master_csv)

    master_df = pd.read_csv(master_file_path)

    master_df = master_df.copy()
    master_df["canon"] = build_master_canon(master_df)

    # --- Search mode
    if args.query:
        master, vec, nn, _ = build_search_index(master_df, ngram=(1, 2), min_df=1)
        res = search_master(master, vec, nn, args.query, top_k=args.top_k)
        print("\nTop matches:")
        print(res.to_string(index=False))

    # --- Keyword analysis mode
    if args.do_keywords:
        if args.category_col not in master_df.columns:
            raise ValueError(f"category_col='{args.category_col}' not found in master columns")

        print("\nTop 20 most informative terms overall:")
        print(top_terms_overall(master_df, text_col="canon", top_n=20).to_string(index=False))

        cat_kw = top_terms_per_category(master_df, category_col=args.category_col, text_col="canon", top_n=3, min_df=1)
        print("\nTop 3 keywords per category:")
        print(cat_kw.head(30).to_string(index=False))

        kw_cov = reverse_keyword_count(master_df, args.category_col, "canon", cat_kw)
        print("\nKeyword coverage per category (sample):")
        print(kw_cov.head(20).to_string(index=False))

        shared_kw, coverage_df, topN = shared_keyword_coverage(
            master_df, args.category_col, "canon", cat_kw,
            min_categories=3, top_categories_per_keyword=5
        )

        print("\nShared keywords (top 20 by number of categories):")
        print(shared_kw.head(20).to_string(index=False))

        print("\nTop categories per shared keyword (by coverage):")
        if len(topN):
            print(topN.head(50).to_string(index=False))
        else:
            print("No shared keywords found with the current settings.")


if __name__ == "__main__":
    main()

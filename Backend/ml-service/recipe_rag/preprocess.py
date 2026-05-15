"""
Recipe Preprocessor — Converts Woolworths JSON-LD recipe files into
text chunks + metadata suitable for embedding and RAG retrieval.

Pure data transformation only — no ML dependencies. This module is
called by build_recipe_index.py (offline) and can also be reused for
re-indexing or testing.
"""

import json
import os
import re
import glob
from typing import List, Dict, Optional, Tuple


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_duration(iso_str: Optional[str]) -> str:
    """Convert ISO 8601 duration (PT30M, PT1H15M) to readable string."""
    if not iso_str:
        return "Not specified"
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", iso_str)
    if not match:
        return iso_str
    hours, minutes = match.groups()
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    return " ".join(parts) if parts else "Not specified"


# ---------------------------------------------------------------------------
# Per-recipe transformation
# ---------------------------------------------------------------------------

def recipe_json_to_text(data) -> Tuple[Optional[str], Optional[Dict]]:
    """
    Convert a recipe JSON-LD object (or list containing one) into:
      - a single text chunk (for embedding)
      - a metadata dict (for retrieval/display)

    Returns (None, None) if the input isn't a valid Recipe schema or
    is generic Woolworths boilerplate.
    """
    # JSON-LD pages sometimes wrap a Recipe inside a list of @graph entries
    recipe = None
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("@type") == "Recipe":
                recipe = item
                break
    elif isinstance(data, dict) and data.get("@type") == "Recipe":
        recipe = data

    if not recipe:
        return None, None

    name = recipe.get("name", "Unknown")
    if name.lower().startswith("woolworths"):
        return None, None  # skip generic landing-page boilerplate

    description = recipe.get("description", "") or ""
    # Strip Woolworths boilerplate phrases
    _BOILERPLATE = [
        "Absolutely delicious with the best ingredients from Woolworths.",
        "Try our easy to follow",
        "from Woolworths",
    ]  
    for phrase in _BOILERPLATE:
        description = description.replace(phrase, "").strip()



    ingredients = recipe.get("recipeIngredient", [])
    instructions = recipe.get("recipeInstructions", [])
    prep_time = parse_duration(recipe.get("prepTime"))
    cook_time = parse_duration(recipe.get("cookTime"))
    servings = recipe.get("recipeYield", "Not specified")
    category = recipe.get("recipeCategory", "Not specified")
    cuisine = recipe.get("recipeCuisine", "Not specified")

    steps = []
    for inst in instructions:
        if isinstance(inst, dict):
            steps.append(inst.get("text", ""))
        elif isinstance(inst, str):
            steps.append(inst)

    text = f"""Recipe: {name}
Description: {description}
Category: {category} | Cuisine: {cuisine}
Prep: {prep_time} | Cook: {cook_time} | Serves: {servings}

Ingredients:
{chr(10).join(f'- {i}' for i in ingredients)}

Instructions:
{chr(10).join(f'{j+1}. {s}' for j, s in enumerate(steps))}"""

    metadata = {
        "name": name,
        "description": description,
        "ingredients": ingredients,
        "category": category,
        "cuisine": cuisine,
        "prep_time": prep_time,
        "cook_time": cook_time,
        "servings": servings,
        "instructions": steps,
    }
    return text, metadata


# ---------------------------------------------------------------------------
# Bulk loaders
# ---------------------------------------------------------------------------

def load_recipes_from_directory(recipe_dir: str) -> List[Dict]:
    """
    Walk a directory of recipe JSON files and return a list of dicts:
        [{"text": str, "metadata": dict, "source_file": str}, ...]

    Skips non-Recipe JSON, missing @type, and Woolworths boilerplate.
    """
    json_files = sorted(glob.glob(os.path.join(recipe_dir, "*.json")))
    print(f"Found {len(json_files)} JSON files in {recipe_dir}")

    recipes = []
    skipped = 0
    errors = 0

    for filepath in json_files:
        fname = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ERROR: {fname} — {e}")
            errors += 1
            continue

        text, meta = recipe_json_to_text(data)
        if not text:
            skipped += 1
            continue

        meta["source_file"] = fname
        recipes.append({
            "text": text,
            "metadata": meta,
            "source_file": fname,
        })

    print(f"Loaded {len(recipes)} recipes "
          f"(skipped {skipped} non-Recipe / boilerplate, {errors} errors)")
    return recipes


def extract_unique_ingredients(
    recipes: List[Dict],
) -> Tuple[List[str], Dict[str, List[int]]]:
    """
    Build a flat list of unique ingredient strings and a mapping from
    each ingredient to the indices of recipes that use it.

    Returns:
        all_ingredients         — list of unique ingredient text
        ingredient_to_recipes   — {ingredient_text: [recipe_idx, ...]}
    """
    ingredient_to_recipes: Dict[str, List[int]] = {}
    all_ingredients: List[str] = []

    for idx, r in enumerate(recipes):
        for ing in r["metadata"]["ingredients"]:
            ing_clean = ing.strip()
            if not ing_clean:
                continue
            if ing_clean not in ingredient_to_recipes:
                ingredient_to_recipes[ing_clean] = []
                all_ingredients.append(ing_clean)
            ingredient_to_recipes[ing_clean].append(idx)

    avg = (
        sum(len(r["metadata"]["ingredients"]) for r in recipes) / len(recipes)
        if recipes else 0
    )
    print(f"Unique ingredients: {len(all_ingredients)} "
          f"(avg {avg:.1f} per recipe across {len(recipes)} recipes)")

    return all_ingredients, ingredient_to_recipes


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    default_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..",
        "Recipe Scraper", "woolworths_recipes",
    )
    recipe_dir = sys.argv[1] if len(sys.argv) > 1 else default_dir

    recipes = load_recipes_from_directory(recipe_dir)
    if recipes:
        print("\n" + "=" * 60)
        print("SAMPLE RECIPE TEXT CHUNK:")
        print("=" * 60)
        print(recipes[0]["text"][:600] + "...")
        print("=" * 60)

        ingredients, mapping = extract_unique_ingredients(recipes)
        print(f"\nFirst 5 unique ingredients:")
        for ing in ingredients[:5]:
            print(f"  '{ing}' → {len(mapping[ing])} recipe(s)")
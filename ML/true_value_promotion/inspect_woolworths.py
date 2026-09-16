import re
import pandas as pd

# 1. LOAD DATA
df = pd.read_csv(
    "data/local_bronze/woolworths/woolworths_brands_20260406_104418.csv"
)

# 2. MAP OFFICIAL WOOLWORTHS CATEGORIES TO DISCOUNTMATE CATEGORIES
CATEGORY_MAPPING = {
    "VEG / FRESHCUTS / HARD PRODUCE": "Fresh Food",
    "FRUIT": "Fresh Food",
    "DAIRY - YOGHURT": "Dairy & Refrigerated",
    "DAIRY - MILK": "Dairy & Refrigerated",
    "DAIRY - CHILLED JUICES & DRINKS": "Dairy & Refrigerated",
    "DAIRY - ENTERTAINING": "Dairy & Refrigerated",
    "DAIRY - BUTTER & MARGARINE": "Dairy & Refrigerated",
    "DAIRY - EGGS": "Dairy & Refrigerated",
    "DAIRY - SNACKS": "Dairy & Refrigerated",
    "DAIRY - CREAM": "Dairy & Refrigerated",
    "DAIRY- PLANT BASED AND ETHNIC": "Dairy & Refrigerated",
    "CHEESE EVERYDAY": "Dairy & Refrigerated",
    "CHEESE ENTERTAINING": "Dairy & Refrigerated",
    "CHEESE COOKING": "Dairy & Refrigerated",
    "COOKING NEEDS": "Pantry",
    "PASTA / RICE": "Pantry",
    "CONDIMENTS": "Pantry",
    "CANNED VEGETABLES": "Pantry",
    "CANNED FRUIT / DESSERTS": "Pantry",
    "CANNED FISH": "Pantry",
    "JAMS / SPREADS": "Pantry",
    "OILS (COOKING)": "Pantry",
    "ETHNIC / GOURMET FOOD": "Pantry",
    "HEALTH FOODS": "Pantry",
    "BREAKFAST FOODS": "Pantry",
    "BISCUITS": "Snacks & Confectionery",
    "CONFECTIONERY": "Snacks & Confectionery",
    "SNACKS": "Snacks & Confectionery",
    "BEVERAGES": "Beverages",
    "CARBONATED SOFT DRINKS": "Beverages",
    "LIFESTYLE/WATER NON CARBONATED": "Beverages",
    "LONGLIFE JUICE / DRINKS": "Beverages",
    "CORDIAL / DRINK BASES": "Beverages",
    "FROZEN MEALS": "Frozen",
    "FREEZER - FISH": "Frozen",
    "FREEZER - VEGETABLES": "Frozen",
    "FREEZER - POULTRY": "Frozen",
    "FREEZER - DESSERTS & PASTRY": "Frozen",
    "ICE CREAM": "Frozen",
    "PROPRIETARY BAKERY": "Bakery",
    "INSTORE BAKERY": "Bakery",
    "MEAT CONVENIENCE": "Meat & Seafood",
    "SEAFOOD CONVENIENCE": "Meat & Seafood",
    "SEAFOOD": "Meat & Seafood",
    "DELI CONVENIENCE": "Meat & Seafood",
    "DELI SERVICE": "Meat & Seafood",
    "CLEANSING": "Cleaning & Household",
    "HOUSEHOLD CLEANING": "Cleaning & Household",
    "PAPERGOODS": "Cleaning & Household",
    "DOMESTICWARE": "Cleaning & Household",
    "HARDWARE": "Cleaning & Household",
    "ELECTRICAL": "Cleaning & Household",
    "TOILETRIES": "Personal Care & Health",
    "HEALTH CARE": "Personal Care & Health",
    "BABY NEEDS": "Baby",
    "BABYWEAR/LAYETTE": "Baby",
    "PET FOOD": "Pet",
    "APPAREL": "General Merchandise",
    "HABERDASHERY": "General Merchandise",
    "NEWSAGENCY": "General Merchandise",
    "STATIONERY": "General Merchandise",
    "HOSIERY": "General Merchandise",
    "GARDEN AIDS/SEEDS/BULBS": "General Merchandise",
    "SEASONAL FOODS": "General Merchandise",
    "APPLIANCES": "General Merchandise",
    "MISCELLANEOUS GENERAL MERCHANDISE": "General Merchandise",
    "PREPARED FOODS": "Pantry",  # corrected: soup etc is Pantry, not General Merchandise
}

df["discountmate_category"] = (
    df["SapCategoryName"].map(CATEGORY_MAPPING).fillna("Other")
)

# 3. NAME-BASED KEYWORD RULES FOR ROWS STILL MISSING A CATEGORY
# Keywords use WHOLE-WORD/PHRASE matching (see guess_category below) to avoid
# substring false positives, e.g. "tea" no longer matches inside "Teams",
# "coffee" alone no longer matches coffee tables/coffee-scented skincare,
# "duck" alone no longer matches Duck Down pillows or rubber duck toys.
KEYWORD_RULES = {
    "Personal Care & Health": [
        "shampoo", "toothpaste", "soap", "deodorant", "sunscreen", "vitamin",
        "razor", "conditioner", "patch", "quit smoking", "nicabate", "toothbrush",
        "skincare", "moisturiser", "moisturizer", "perfume", "eau de toilette",
        "cologne", "scrub", "mascara", "hairspray", "concealer",
        "dressing spray", "plaster", "lozenges", "eyebrow", "setting spray",
        "lutein", "sustagen", "piksters", "interdental", "corn gel",
        "lipstick", "nail polish", "lip balm", "blackmores", "nature's sunshine",
        "body wash", "hair dye", "hair cream", "hair colour", "hair color",
        "betadine", "durex", "curcumin", "collagen", "leave-in", "exfoliator",
        "mouthguard", "sukin", "elastoplast", "hand wash", "eczema",
    ],
    "Pantry": [
        "spice", "cinnamon", "seasoning", "stock cube", "gravy", "spirulina",
        "grinder", "cast iron", "beeswax wraps", "frypan",
        "le snak", "mylk", "magnesium", "protein", "nutrition",
        "soup", "sauce", "olives", "chickpeas", "instant coffee", "coffee pods",
        "coffee beans", "coffee capsules",
    ],
    "Beverages": [
        "juice", "soda", "drink", "cordial", "soft drink",
        "schweppes", "kombucha", "coca-cola", "coca cola", "sprite", "fanta",
        "ginger beer", "energy drink",
        # "tea" and "coffee" require word-boundary matching (handled below)
        "tea", "coffee",
    ],
    "Snacks & Confectionery": [
        "chocolate", "lolly", "lollies", "candy", "cracker", "chip",
        "muesli bar", "crostini",
    ],
    "Cleaning & Household": [
        "detergent", "cleaner", "cleaning", "tissue", "paper towel",
        "dishwasher", "toilet brush", "saniwand", "dishwashing",
        "rubbish bin", "gloves", "bleach", "stain remover", "fabric conditioner",
        "car wash", "odour neutralising",
    ],
    "Dairy & Refrigerated": [
        "milk", "yoghurt", "yogurt", "cheese", "butter", "egg",
        "dairy", "greek yoghurt", "falafel",
    ],
    "General Merchandise": ["batteries", "battery", "lunch pocket"],
    "Baby": [
        "nappy", "nappies", "baby", "infant", "formula", "soothie", "teether",
        "toddler milk",
    ],
    "Pet": [
        "dog food", "cat food", "dogs toy", "dog toy", "dog treat", "cat treat",
        "pet bed", "wet dog", "wet cat", "cat milk", "cat treats",
    ],
    "Frozen": ["frozen", "ice cream", "sorbet", "bavarian"],
    "Bakery": [
        "bread loaf", "bread bakery", "bakery", "bread toast", "bread vitamins",
        "wraps original", "pizza base", "gluten free bread", "doughnut",
        "burger buns", "waffles",
    ],
    "Meat & Seafood": [
        "chicken", "beef", "pork", "lamb", "prawn", "seafood", "salami",
        "prosciutto", "duck breast", "duck curry", "peking duck", "duck burger",
    ],
    "Fresh Food": [
        "banana", "lettuce", "tomato", "carrot organic", "cider vinegar",
        "sweet potato", "parsley bunch", "celery sticks", "organic mango",
        "garlic cloves", "capsicum", "salad mix", "organic kale", "beetroot",
    ],
}

# Words that need whole-word matching (short/common words prone to substring
# false positives, e.g. "tea" inside "Teams", "coffee" inside "coffee table").
WORD_BOUNDARY_KEYWORDS = {"tea", "coffee"}


def _keyword_matches(name, keyword):
    if keyword in WORD_BOUNDARY_KEYWORDS:
        return re.search(r'\b' + re.escape(keyword) + r'\b', name) is not None
    return keyword in name


def guess_category(name):
    name = str(name).lower()
    for category, keywords in KEYWORD_RULES.items():
        if any(_keyword_matches(name, word) for word in keywords):
            return category
    return "Other"


mask_other = df["discountmate_category"] == "Other"
df.loc[mask_other, "discountmate_category"] = df.loc[mask_other, "Name"].apply(
    guess_category
)

# 4. DIAGNOSTICS
print(f"Rows unmapped initially (no SapCategoryName): {df['SapCategoryName'].isna().sum()}")
print(f"Rows still classified as 'Other' after all rules: {(df['discountmate_category'] == 'Other').sum()}")
print("\nFinal Grocery App Category Breakdown:")
print(df["discountmate_category"].value_counts())

# 5. SAVE FULL CATEGORISED OUTPUT
df.to_csv("data/local_bronze/woolworths/woolworths_categorised.csv", index=False)
print("\nSaved categorised output to woolworths_categorised.csv")

# 6. EXPORT REMAINING 'OTHER' ROWS FOR MANUAL REVIEW
still_other = df[df["discountmate_category"] == "Other"]
still_other[["Name", "PackageSize", "Price"]].sort_values("Name").to_csv(
    "data/local_bronze/woolworths/still_other_review.csv", index=False
)
print(f"Exported {len(still_other)} unmapped products to still_other_review.csv for manual review.")

# 7. VALIDATION - SPOT CHECK SAMPLES FROM EACH CATEGORY
print("\n\n=== VALIDATION: Sample products from each category ===")
categories = df["discountmate_category"].unique()

for cat in categories:
    if cat == "Other":
        continue
    cat_df = df[df["discountmate_category"] == cat]
    sample = cat_df["Name"].sample(min(10, len(cat_df)), random_state=1)
    print(f"\n--- {cat} ({len(cat_df)} total) ---")
    print(sample.to_string())

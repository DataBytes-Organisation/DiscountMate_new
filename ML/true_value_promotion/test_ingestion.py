from true_value_promotion.ingestion import load_all_retailers

coles, woolworths, iga = load_all_retailers(
    "true_value_promotion/data/coles_brands_20260504_053141.csv",
    "true_value_promotion/data/woolworths_brands_20260504_074111.csv",
    "true_value_promotion/data/iga_all_products_20260504_053210.csv"
)

print("Coles shape:", coles.shape)
print("Woolworths shape:", woolworths.shape)
print("IGA shape:", iga.shape)

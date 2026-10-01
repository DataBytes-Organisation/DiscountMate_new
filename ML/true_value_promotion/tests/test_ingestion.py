from ML.true_value_promotion.ingestion import load_all_retailers

coles, woolworths, iga = load_all_retailers()

print("Coles shape:", coles.shape)
print("Woolworths shape:", woolworths.shape)
print("IGA shape:", iga.shape)

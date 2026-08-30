const { EntitySchema } = require('typeorm');
const timestampColumns = {
  createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
  updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
};

const ShoppingListEntity = new EntitySchema({
  name: 'ShoppingList',
  tableName: 'shopping_lists',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    name: { type: 'text' },
    description: { type: 'text', default: '' },
    accent: { type: 'text', default: 'emerald' },
    isActive: { name: 'is_active', type: 'boolean', default: false },
    total: { type: 'numeric', precision: 12, scale: 2, default: 0 },
    savings: { type: 'numeric', precision: 12, scale: 2, default: 0 },
    ...timestampColumns,
  },
});

const ShoppingListItemEntity = new EntitySchema({
  name: 'ShoppingListItem',
  tableName: 'shopping_list_items',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    shoppingListId: { name: 'shopping_list_id', type: 'uuid' },
    lineNumber: { name: 'line_number', type: 'integer' },
    productId: { name: 'product_id', type: 'uuid', nullable: true },
    legacyProductIdentifier: { name: 'legacy_product_identifier', type: 'text' },
    productName: { name: 'product_name', type: 'text' },
    quantity: { type: 'integer', default: 1 },
    unitPrice: { name: 'unit_price', type: 'numeric', precision: 12, scale: 2, default: 0 },
    retailerId: { name: 'retailer_id', type: 'uuid', nullable: true },
    selectedRetailerKey: { name: 'selected_retailer_key', type: 'text', nullable: true },
    imageUrl: { name: 'image_url', type: 'text', nullable: true },
    categoryId: { name: 'category_id', type: 'uuid', nullable: true },
    legacyCategoryIdentifier: {
      name: 'legacy_category_identifier',
      type: 'text',
      nullable: true,
    },
    categoryName: { name: 'category_name', type: 'text', nullable: true },
    retailerPrices: { name: 'retailer_prices', type: 'jsonb', default: {} },
    rawPayload: { name: 'raw_payload', type: 'jsonb', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
  },
});

const ListPricingSnapshotEntity = new EntitySchema({
  name: 'ListPricingSnapshot',
  tableName: 'list_pricing_snapshots',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    shoppingListId: { name: 'shopping_list_id', type: 'uuid', nullable: true },
    legacyShoppingListId: { name: 'legacy_shopping_list_id', type: 'text' },
    listName: { name: 'list_name', type: 'text' },
    selectedRetailerId: { name: 'selected_retailer_id', type: 'uuid', nullable: true },
    selectedRetailerKey: { name: 'selected_retailer_key', type: 'text', nullable: true },
    retailerTotals: { name: 'retailer_totals', type: 'jsonb', default: {} },
    comparisonStatus: { name: 'comparison_status', type: 'text' },
    comparableRetailerCount: { name: 'comparable_retailer_count', type: 'integer', default: 0 },
    availableRetailers: { name: 'available_retailers', type: 'text', array: true, default: [] },
    cheapestRetailerId: { name: 'cheapest_retailer_id', type: 'uuid', nullable: true },
    cheapestRetailerKey: { name: 'cheapest_retailer_key', type: 'text', nullable: true },
    cheapestTotal: { name: 'cheapest_total', type: 'numeric', precision: 12, scale: 2, default: 0 },
    highestRetailerId: { name: 'highest_retailer_id', type: 'uuid', nullable: true },
    highestRetailerKey: { name: 'highest_retailer_key', type: 'text', nullable: true },
    highestTotal: { name: 'highest_total', type: 'numeric', precision: 12, scale: 2, default: 0 },
    selectedTotal: { name: 'selected_total', type: 'numeric', precision: 12, scale: 2, default: 0 },
    totalSaved: { name: 'total_saved', type: 'numeric', precision: 12, scale: 2, default: 0 },
    savingsRate: { name: 'savings_rate', type: 'numeric', precision: 7, scale: 2, default: 0 },
    comparisonLabel: { name: 'comparison_label', type: 'text' },
    itemCount: { name: 'item_count', type: 'integer', default: 0 },
    source: { type: 'text' },
    rawPayload: { name: 'raw_payload', type: 'jsonb', nullable: true },
    ...timestampColumns,
  },
});

module.exports = {
  ListPricingSnapshotEntity,
  ShoppingListEntity,
  ShoppingListItemEntity,
};

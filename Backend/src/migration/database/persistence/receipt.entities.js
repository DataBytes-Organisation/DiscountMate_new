const { EntitySchema } = require('typeorm');
const ReceiptEntity = new EntitySchema({
  name: 'Receipt',
  tableName: 'receipts',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    sourceReceiptKey: { name: 'source_receipt_key', type: 'text', unique: true, nullable: true },
    retailerId: { name: 'retailer_id', type: 'uuid', nullable: true },
    storeName: { name: 'store_name', type: 'text' },
    receiptNumber: { name: 'receipt_number', type: 'text', nullable: true },
    purchasedAt: { name: 'purchased_at', type: 'timestamptz', nullable: true },
    uploadedAt: { name: 'uploaded_at', type: 'timestamptz' },
    subtotal: { type: 'numeric', precision: 12, scale: 2, nullable: true },
    total: { type: 'numeric', precision: 12, scale: 2, nullable: true },
    savings: { type: 'numeric', precision: 12, scale: 2, nullable: true },
    source: { type: 'text', default: 'ocr' },
    rawPayload: { name: 'raw_payload', type: 'jsonb', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

const ReceiptItemEntity = new EntitySchema({
  name: 'ReceiptItem',
  tableName: 'receipt_items',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    receiptId: { name: 'receipt_id', type: 'uuid' },
    lineNumber: { name: 'line_number', type: 'integer' },
    itemName: { name: 'item_name', type: 'text', nullable: true },
    quantity: { type: 'numeric', precision: 12, scale: 3, default: 1 },
    unitPrice: { name: 'unit_price', type: 'numeric', precision: 12, scale: 2, nullable: true },
    lineTotal: { name: 'line_total', type: 'numeric', precision: 12, scale: 2, nullable: true },
    matchedProductId: { name: 'matched_product_id', type: 'uuid', nullable: true },
    rawPayload: { name: 'raw_payload', type: 'jsonb', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
  },
});

module.exports = { ReceiptEntity, ReceiptItemEntity };

const { EntitySchema } = require('typeorm');
const NotificationEntity = new EntitySchema({
  name: 'Notification',
  tableName: 'notifications',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    type: { type: 'text', default: 'general' },
    title: { type: 'text' },
    message: { type: 'text', default: '' },
    isRead: { name: 'is_read', type: 'boolean', default: false },
    categoryId: { name: 'category_id', type: 'uuid', nullable: true },
    categoryKey: { name: 'category_key', type: 'text', nullable: true },
    categoryLabel: { name: 'category_label', type: 'text', nullable: true },
    ctaRoute: { name: 'cta_route', type: 'text', nullable: true },
    dealKey: { name: 'deal_key', type: 'text', nullable: true },
    sourceTypes: { name: 'source_types', type: 'text', array: true, default: [] },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

const NotificationProductReferenceEntity = new EntitySchema({
  name: 'NotificationProductReference',
  tableName: 'notification_product_references',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    notificationId: { name: 'notification_id', type: 'uuid' },
    lineNumber: { name: 'line_number', type: 'integer' },
    productId: { name: 'product_id', type: 'uuid', nullable: true },
    legacyProductIdentifier: { name: 'legacy_product_identifier', type: 'text' },
  },
});

module.exports = {
  NotificationEntity,
  NotificationProductReferenceEntity,
};

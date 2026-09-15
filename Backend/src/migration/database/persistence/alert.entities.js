const { EntitySchema } = require('typeorm');
const AlertSegmentEntity = new EntitySchema({
  name: 'AlertSegment',
  tableName: 'alert_segments',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    categoryId: { name: 'category_id', type: 'uuid', nullable: true },
    categoryKey: { name: 'category_key', type: 'text' },
    categoryLabel: { name: 'category_label', type: 'text' },
    active: { type: 'boolean', default: false },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

module.exports = { AlertSegmentEntity };

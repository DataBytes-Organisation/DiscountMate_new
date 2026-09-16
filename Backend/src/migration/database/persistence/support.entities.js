const { EntitySchema } = require('typeorm');

const SupportRequestEntity = new EntitySchema({
  name: 'SupportRequest',
  tableName: 'support_requests',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    referenceNumber: { name: 'reference_number', type: 'text', unique: true },
    userId: { name: 'user_id', type: 'uuid', nullable: true },
    name: { type: 'text' },
    email: { type: 'citext' },
    topic: { type: 'text' },
    subject: { type: 'text', nullable: true },
    message: { type: 'text' },
    supportEmail: { name: 'support_email', type: 'citext' },
    emailStatus: { name: 'email_status', type: 'text' },
    status: { type: 'text', default: 'received' },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

const SupportRequestAttachmentEntity = new EntitySchema({
  name: 'SupportRequestAttachment',
  tableName: 'support_request_attachments',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    supportRequestId: {
      name: 'support_request_id',
      type: 'uuid',
      unique: true,
    },
    originalName: { name: 'original_name', type: 'text' },
    mimeType: { name: 'mime_type', type: 'text' },
    sizeBytes: { name: 'size_bytes', type: 'integer' },
    data: { type: 'bytea' },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
  },
});

module.exports = {
  SupportRequestAttachmentEntity,
  SupportRequestEntity,
};

const { EntitySchema } = require('typeorm');
const timestampColumns = {
  createdAt: {
    name: 'created_at',
    type: 'timestamptz',
    createDate: true,
  },
  updatedAt: {
    name: 'updated_at',
    type: 'timestamptz',
    updateDate: true,
  },
};

const UserEntity = new EntitySchema({
  name: 'User',
  tableName: 'users',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'citext', unique: true },
    passwordHash: { name: 'password_hash', type: 'text' },
    role: { type: 'text', default: 'user' },
    status: { type: 'text', default: 'active' },
    emailVerifiedAt: { name: 'email_verified_at', type: 'timestamptz', nullable: true },
    phoneVerifiedAt: { name: 'phone_verified_at', type: 'timestamptz', nullable: true },
    passwordChangedAt: { name: 'password_changed_at', type: 'timestamptz', nullable: true },
    ...timestampColumns,
  },
});

const UserProfileEntity = new EntitySchema({
  name: 'UserProfile',
  tableName: 'user_profiles',
  schema: 'app',
  columns: {
    userId: { name: 'user_id', type: 'uuid', primary: true },
    firstName: { name: 'first_name', type: 'varchar', length: 100, nullable: true },
    lastName: { name: 'last_name', type: 'varchar', length: 100, nullable: true },
    phoneNumber: { name: 'phone_number', type: 'varchar', length: 32, nullable: true },
    address: { type: 'text', nullable: true },
    postcode: { type: 'char', length: 4, nullable: true },
    dateOfBirth: { name: 'date_of_birth', type: 'date', nullable: true },
    bio: { type: 'text', nullable: true },
    legacyProfileId: { name: 'legacy_profile_id', type: 'text', nullable: true },
    ...timestampColumns,
  },
});

const UserProfileImageEntity = new EntitySchema({
  name: 'UserProfileImage',
  tableName: 'user_profile_images',
  schema: 'app',
  columns: {
    userId: { name: 'user_id', type: 'uuid', primary: true },
    mimeType: { name: 'mime_type', type: 'varchar', length: 100 },
    imageData: { name: 'image_data', type: 'bytea' },
    ...timestampColumns,
  },
});

const UserNotificationPreferenceEntity = new EntitySchema({
  name: 'UserNotificationPreference',
  tableName: 'user_notification_preferences',
  schema: 'app',
  columns: {
    userId: { name: 'user_id', type: 'uuid', primary: true },
    priceAlertsEnabled: { name: 'price_alerts_enabled', type: 'boolean', default: true },
    weeklySummaryEnabled: { name: 'weekly_summary_enabled', type: 'boolean', default: true },
    browserNotificationsEnabled: {
      name: 'browser_notifications_enabled',
      type: 'boolean',
      default: true,
    },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

const UserDashboardPreferenceEntity = new EntitySchema({
  name: 'UserDashboardPreference',
  tableName: 'user_dashboard_preferences',
  schema: 'app',
  columns: {
    userId: { name: 'user_id', type: 'uuid', primary: true },
    selectedListId: { name: 'selected_list_id', type: 'uuid', nullable: true },
    selectedRetailerId: { name: 'selected_retailer_id', type: 'uuid', nullable: true },
    selectedRetailerKey: {name: 'selected_retailer_key', type: 'text', default: 'coles'},
    legacySelectedListId: { name: 'legacy_selected_list_id', type: 'text', nullable: true },
    ...timestampColumns,
  },
});

const UserLegacyMetricEntity = new EntitySchema({
  name: 'UserLegacyMetric',
  tableName: 'user_legacy_metrics',
  schema: 'app',
  columns: {
    userId: { name: 'user_id', type: 'uuid', primary: true },
    totalSaved: { name: 'total_saved', type: 'numeric', precision: 12, scale: 2, default: 0},
    shoppingTrips: { name: 'shopping_trips', type: 'integer', default: 0 },
    shoppingListsCount: { name: 'shopping_lists_count', type: 'integer', default: 0 },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

module.exports = {
  UserEntity,
  UserProfileEntity,
  UserProfileImageEntity,
  UserNotificationPreferenceEntity,
  UserDashboardPreferenceEntity,
  UserLegacyMetricEntity,
};

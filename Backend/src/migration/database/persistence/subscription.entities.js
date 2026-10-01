const { EntitySchema } = require('typeorm');
const SubscriptionPlanEntity = new EntitySchema({
  name: 'SubscriptionPlan',
  tableName: 'subscription_plans',
  schema: 'app',
  columns: {
    code: { type: 'text', primary: true },
    displayName: { name: 'display_name', type: 'text' },
    priceCents: { name: 'price_cents', type: 'integer' },
    currency: { type: 'char', length: 3, default: 'AUD' },
    billingInterval: { name: 'billing_interval', type: 'text' },
    priceSuffix: { name: 'price_suffix', type: 'text' },
    badge: { type: 'text', nullable: true },
    maxActiveAlerts: { name: 'max_active_alerts', type: 'integer', nullable: true },
    maxSavedLists: { name: 'max_saved_lists', type: 'integer', nullable: true },
    isActive: { name: 'is_active', type: 'boolean', default: true },
    displayOrder: { name: 'display_order', type: 'integer' },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

const SubscriptionPlanFeatureEntity = new EntitySchema({
  name: 'SubscriptionPlanFeature',
  tableName: 'subscription_plan_features',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    planCode: { name: 'plan_code', type: 'text' },
    displayText: { name: 'display_text', type: 'text' },
    displayOrder: { name: 'display_order', type: 'integer' },
  },
});

const UserSubscriptionEntity = new EntitySchema({
  name: 'UserSubscription',
  tableName: 'user_subscriptions',
  schema: 'app',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { name: 'user_id', type: 'uuid' },
    planCode: { name: 'plan_code', type: 'text' },
    status: { type: 'text' },
    source: { type: 'text' },
    providerCustomerId: { name: 'provider_customer_id', type: 'text', nullable: true },
    providerSubscriptionId: {
      name: 'provider_subscription_id',
      type: 'text',
      nullable: true,
    },
    startedAt: { name: 'started_at', type: 'timestamptz' },
    currentPeriodStart: { name: 'current_period_start', type: 'timestamptz', nullable: true },
    currentPeriodEnd: { name: 'current_period_end', type: 'timestamptz', nullable: true },
    cancelledAt: { name: 'cancelled_at', type: 'timestamptz', nullable: true },
    endedAt: { name: 'ended_at', type: 'timestamptz', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});

module.exports = {
  SubscriptionPlanEntity,
  SubscriptionPlanFeatureEntity,
  UserSubscriptionEntity,
};

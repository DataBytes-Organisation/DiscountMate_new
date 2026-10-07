const userEntities = require('./persistence/user.entities');
const subscriptionEntities = require('./persistence/subscription.entities');
const receiptEntities = require('./persistence/receipt.entities');
const listEntities = require('./persistence/list.entities');
const alertEntities = require('./persistence/alert.entities');
const notificationEntities = require('./persistence/notification.entities');
const supportEntities = require('./persistence/support.entities');

module.exports = [
  ...Object.values(userEntities),
  ...Object.values(subscriptionEntities),
  ...Object.values(receiptEntities),
  ...Object.values(listEntities),
  ...Object.values(alertEntities),
  ...Object.values(notificationEntities),
  ...Object.values(supportEntities),
];

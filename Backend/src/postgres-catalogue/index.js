const {
  closePostgresCatalogue,
  getPostgresCatalogueCapability,
  getPostgresCatalogueReadModel,
  initializePostgresCatalogue,
} = require('./database/catalogue-data-source');

const {
  createPostgresCatalogueRouter,
} = require('./routers/postgres-catalogue.router');

module.exports = {
  closePostgresCatalogue,
  createPostgresCatalogueRouter,
  getPostgresCatalogueCapability,
  getPostgresCatalogueReadModel,
  initializePostgresCatalogue,
};

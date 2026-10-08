const { ObjectId } = require('mongodb');
const { connectToMongoDB } = require('../../config/database');

class MongoListRepository {
  constructor(connect = connectToMongoDB) {
    this.connect = connect;
  }

  async getList(listId, userRef) {
    if (!ObjectId.isValid(String(listId))) return null;
    const db = await this.connect();
    const user = await db.collection('users').findOne({ email: String(userRef).toLowerCase() });
    if (!user) return null;
    const doc = await db.collection('shopping_lists').findOne({
      _id: new ObjectId(String(listId)),
      user_id: String(user._id),
    });
    if (!doc) return null;

    const rawItems = Array.isArray(doc.items) ? doc.items : [];
    const legacyRefs = rawItems
      .map((item) => (
        item.product_id || item.productId || item.product_code || item.productCode || item.id
      ))
      .filter((value) => value != null && String(value).trim())
      .map(String);
    const legacyObjectIds = legacyRefs
      .filter((value) => ObjectId.isValid(value))
      .map((value) => new ObjectId(value));

    const products = legacyRefs.length
      ? await db.collection('products').find({
        $or: [
          { _id: { $in: legacyObjectIds } },
          { product_code: { $in: legacyRefs } },
        ],
      }).toArray()
      : [];

    const productById = new Map();
    products.forEach((product) => {
      productById.set(String(product._id), product);
      if (product.product_code != null) productById.set(String(product.product_code), product);
    });

    return {
      id: String(doc._id),
      name: doc.list_name || doc.name || 'Saved list',
      items: rawItems.map((item, index) => {
        const legacyProductId = String(
          item.product_id || item.productId || item.product_code || item.productCode || item.id || '',
        );

        const product = productById.get(legacyProductId) || {};

        return {
          lineItemId: String(item._id || item.lineItemId || item.id || `${legacyProductId || 'custom'}:${index}`),
          legacyProductId,
          deProductId: item.comparison_product_id || item.comparisonProductId || item.de_product_id || item.deProductId || null,
          name: item.name || item.product_name || product.name || product.product_name || 'Product',
          brand: item.brand || product.brand || product.brand_name || null,
          gtin: item.gtin || item.barcode || product.gtin || product.barcode || null,
          packQuantity: item.packQuantity || item.pack_quantity || product.packQuantity || product.pack_quantity || product.package_size || product.unit_per_prod || null,
          packUom: item.packUom || item.pack_uom || product.packUom || product.pack_uom || product.package_unit || product.measurement || null,
          imageUrl: item.imageUrl || item.image || product.imageUrl || product.image_url || product.image || null,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        };
      }),
    };
  }
}

module.exports = { MongoListRepository };

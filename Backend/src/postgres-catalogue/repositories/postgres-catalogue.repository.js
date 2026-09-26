const SORT_SQL = {
  name_asc: ['product_name ASC, id ASC', 'page.product_name ASC, page.id ASC'],
  name_desc: ['product_name DESC, id ASC', 'page.product_name DESC, page.id ASC'],
  price_asc: [
    'current_price ASC NULLS LAST, product_name ASC, id ASC',
    'page.current_price ASC NULLS LAST, page.product_name ASC, page.id ASC',
  ],
  price_desc: [
    'current_price DESC NULLS LAST, product_name ASC, id ASC',
    'page.current_price DESC NULLS LAST, page.product_name ASC, page.id ASC',
  ],
  newest: ['updated_at DESC, id ASC', 'page.updated_at DESC, page.id ASC'],
};

const READ_MODEL_SQL = {
  finalised: {
    categoryMetadataTable: 'app.category_metadata',
    productMetadataTable: 'app.product_metadata',
    productPackDisplayColumn: 'pack_display_unit',
    priceMetadataTable: 'app.product_price_metadata',
    unitPriceLabelColumn: 'unit_price_label',
  },
  migration: {
    categoryMetadataTable: 'app.category_api_compatibility',
    productMetadataTable: 'app.product_api_compatibility',
    productPackDisplayColumn: 'source_measurement',
    priceMetadataTable: 'app.product_price_source_records',
    unitPriceLabelColumn: 'raw_unit_price',
  },
};

class PostgresCatalogueRepository {
  constructor(dataSourceProvider, readModelProvider = () => 'finalised') {
    this.dataSourceProvider = dataSourceProvider;
    this.readModelProvider = readModelProvider;
  }

  get dataSource() {
    return this.dataSourceProvider();
  }

  get readModelSql() {
    const readModel = this.readModelProvider();
    const sql = READ_MODEL_SQL[readModel];

    if (!sql) {
      throw new Error(`Unsupported PostgreSQL catalogue read model: ${readModel}`);
    }

    return sql;
  }

  async listCategories() {
    const { categoryMetadataTable } = this.readModelSql;

    return this.dataSource.query(`
      SELECT
        category.id,
        category.category_name,
        metadata.description,
        metadata.icon_url,
        metadata.display_order,
        count(product.id)::integer AS product_count
      FROM silver.dim_categories category
      LEFT JOIN silver.dim_products product
        ON product.category_id = category.id
      LEFT JOIN ${categoryMetadataTable} metadata
        ON metadata.category_id = category.id
      WHERE metadata.is_active IS DISTINCT FROM false
      GROUP BY category.id, category.category_name, metadata.description, metadata.icon_url, metadata.display_order
      ORDER BY metadata.display_order ASC NULLS LAST, category.category_name ASC
    `);
  }

  async listProducts({
    search = null,
    categoryId = null,
    retailerId = null,
    specialsOnly = false,
    productId = null,
    page = 1,
    pageSize = 24,
    sort = 'name_asc',
  }) {
    const {
      productMetadataTable,
      productPackDisplayColumn,
      priceMetadataTable,
      unitPriceLabelColumn,
    } = this.readModelSql;

    const [pageSort, finalSort] = SORT_SQL[sort] || SORT_SQL.name_asc;
    const offset = (page - 1) * pageSize;
    const rows = await this.dataSource.query(`
      WITH latest_prices AS (
        SELECT DISTINCT ON (price.product_id, price.retailer_id)
          price.id,
          price.product_id,
          price.retailer_id,
          price.price,
          price.unit_price,
          price_metadata.${unitPriceLabelColumn} AS unit_price_label,
          price.is_on_special,
          price.special_text,
          price.product_url,
          price.recorded_at
        FROM silver.fct_product_prices price
        LEFT JOIN ${priceMetadataTable} price_metadata
          ON price_metadata.price_fact_id = price.id
          AND price_metadata.price_recorded_at = price.recorded_at
        WHERE price.price > 0
        ORDER BY
          price.product_id,
          price.retailer_id,
          price.recorded_at DESC,
          price.created_at DESC,
          price.id DESC
      ),
      matching_products AS (
        SELECT
          product.id,
          product.category_id,
          product.product_name,
          product.brand_name,
          product.gtin,
          product.pack_quantity,
          product.pack_uom,
          product_metadata.${productPackDisplayColumn} AS pack_display_unit,
          product.image_link_side,
          product.image_link_back,
          product.prophet_price_pred,
          product.prophet_on_sale_pred,
          product.xgboost_price_pred,
          product.true_value_classification,
          product.created_at,
          product.updated_at,
          category.category_name,
          product_metadata.description,
          COALESCE(product_metadata.image_link_primary, product.image_link_side) AS image_link_primary,
          min(latest.price) FILTER (WHERE latest.price > 0) AS current_price
        FROM silver.dim_products product
        LEFT JOIN silver.dim_categories category
          ON category.id = product.category_id
        LEFT JOIN ${productMetadataTable} product_metadata
          ON product_metadata.product_id = product.id
        LEFT JOIN latest_prices latest
          ON latest.product_id = product.id
        WHERE ($1::text IS NULL OR (
          product.product_name ILIKE '%' || $1 || '%'
          OR product.brand_name ILIKE '%' || $1 || '%'
        ))
          AND ($2::uuid IS NULL OR product.category_id = $2)
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1
            FROM latest_prices retailer_price
            WHERE retailer_price.product_id = product.id
              AND retailer_price.retailer_id = $3
          ))
          AND ($4::boolean = false OR EXISTS (
            SELECT 1
            FROM latest_prices special_price
            WHERE special_price.product_id = product.id
              AND special_price.is_on_special = true
          ))
          AND ($5::uuid IS NULL OR product.id = $5)
        GROUP BY product.id, category.category_name,
          product_metadata.description,
          product_metadata.image_link_primary,
          product_metadata.${productPackDisplayColumn}
      ),
      page AS (
        SELECT matching_products.*, count(*) OVER()::integer AS total_count
        FROM matching_products
        ORDER BY ${pageSort}
        LIMIT $6 OFFSET $7
      )
      SELECT
        page.*,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'retailerId', retailer.id,
              'retailerName', retailer.retailer_name,
              'websiteUrl', retailer.website_url,
              'price', latest.price,
              'unitPrice', latest.unit_price,
              'unitPriceLabel', latest.unit_price_label,
              'isOnSpecial', latest.is_on_special,
              'specialText', latest.special_text,
              'productUrl', latest.product_url,
              'recordedAt', latest.recorded_at
            ) ORDER BY retailer.retailer_name
          ),
          '[]'::jsonb
        ) AS prices
      FROM page
      CROSS JOIN silver.dim_retailers retailer
      LEFT JOIN latest_prices latest
        ON latest.product_id = page.id
        AND latest.retailer_id = retailer.id
      GROUP BY
        page.id,
        page.category_id,
        page.product_name,
        page.brand_name,
        page.gtin,
        page.pack_quantity,
        page.pack_uom,
        page.pack_display_unit,
        page.image_link_side,
        page.image_link_back,
        page.prophet_price_pred,
        page.prophet_on_sale_pred,
        page.xgboost_price_pred,
        page.true_value_classification,
        page.created_at,
        page.updated_at,
        page.category_name,
        page.description,
        page.image_link_primary,
        page.current_price,
        page.total_count
      ORDER BY ${finalSort}
    `, [
      search,
      categoryId,
      retailerId,
      specialsOnly,
      productId,
      pageSize,
      offset,
    ]);

    return {
      rows,
      total: rows.length > 0 ? Number(rows[0].total_count || 0) : 0,
    };
  }

  async findProductById(productId) {
    const result = await this.listProducts({
      productId,
      page: 1,
      pageSize: 1,
    });

    return result.rows[0] || null;
  }
}

module.exports = { PostgresCatalogueRepository, READ_MODEL_SQL, SORT_SQL };

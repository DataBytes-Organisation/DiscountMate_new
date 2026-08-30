const { isUuid } = require('./de-comparison.repository');

class AppComparisonRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async persistRun(snapshot) {
    this.requireDatabase();
    const client = await this.connect();

    try {
      await client.query('BEGIN');
      const userId = isUuid(snapshot.userId) ? snapshot.userId : null;
      const listId = isUuid(snapshot.listId) ? snapshot.listId : null;
      await client.query(`
                INSERT INTO app.comparison_runs (
                    id, parent_run_id, user_id, legacy_user_ref, list_id, legacy_list_ref,
                    list_name, status, objective, max_retailers, allow_store_brand_substitutions,
                    calculation_policy_version, de_data_watermark, warnings, snapshot_json, created_at
                ) VALUES (
                    $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6,
                    $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16
                )
            `, [
        snapshot.id,
        isUuid(snapshot.parentRunId) ? snapshot.parentRunId : null,
        userId,
        userId ? null : String(snapshot.userId || ''),
        listId,
        listId ? null : String(snapshot.listId || ''),
        snapshot.listName,
        snapshot.status,
        snapshot.objective,
        snapshot.maxRetailers,
        snapshot.allowStoreBrandSubstitutions,
        snapshot.calculationPolicyVersion,
        snapshot.dataWatermark,
        JSON.stringify(snapshot.warnings || []),
        JSON.stringify(snapshot),
        snapshot.createdAt,
      ]);

      for (const result of snapshot.retailerResults || []) {
        const retailerResult = await client.query(`
                    INSERT INTO app.comparison_retailer_results (
                        run_id, retailer_id, retailer_name, total_amount, currency,
                        savings_amount, coverage_found, coverage_total, substitution_count,
                        rank_eligible, snapshot_json
                    ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
                    RETURNING id
                `, [
          snapshot.id, result.retailerId, result.retailerName, result.total.amount,
          result.total.currency, result.savings?.amount || '0.00', result.coverage.found,
          result.coverage.total, result.substitutions, result.rankEligible,
          JSON.stringify(result),
        ]);

        for (const item of result.itemResults || []) {
          await insertItemResult(client, snapshot.id, retailerResult.rows[0].id, item);
        }
      }

      for (let rank = 0; rank < (snapshot.plans || []).length; rank += 1) {
        const plan = snapshot.plans[rank];
        await client.query(`
                    INSERT INTO app.comparison_plans (
                        id, run_id, rank, total_amount, currency, savings_amount,
                        coverage_found, coverage_total, retailer_count,
                        substitution_count, snapshot_json
                    ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
                `, [
          plan.id, snapshot.id, rank + 1, plan.total.amount, plan.total.currency,
          plan.savings?.amount || '0.00', plan.coverage.found, plan.coverage.total,
          plan.retailers.length, plan.substitutions, JSON.stringify(plan),
        ]);

        for (const item of plan.items || []) {
          await client.query(`
                        INSERT INTO app.comparison_plan_items (
                            plan_id, line_item_id, de_product_id, product_name, quantity, retailer_id,
                            retailer_name, price_amount, currency, product_url, observed_at,
                            substitution_json, snapshot_json
                        ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6::uuid, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
                    `, [
            plan.id, item.lineItemId || item.productId, item.productId, item.productName, item.quantity,
            item.retailerId, item.retailerName, item.price.amount,
            item.price.currency, item.productUrl, item.observedAt,
            JSON.stringify(item.substitution), JSON.stringify(item),
          ]);
        }
      }
      await client.query('COMMIT');

      return snapshot;
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.source) error.source = 'app';
      throw error;
    } finally {
      client.release();
    }
  }

  async getRun(runId, userRef) {
    this.requireDatabase();
    const result = await this.query(`
            SELECT snapshot_json
            FROM app.comparison_runs
            WHERE id = $1::uuid
              AND (user_id::text = $2 OR legacy_user_ref = $2)
        `, [runId, String(userRef || '')]);

    return result.rows[0]?.snapshot_json || null;
  }

  async getLatestRunForList(listRef, userRef) {
    this.requireDatabase();
    const result = await this.query(`
            SELECT snapshot_json
            FROM app.comparison_runs
            WHERE (list_id::text = $1 OR legacy_list_ref = $1)
              AND (user_id::text = $2 OR legacy_user_ref = $2)
              AND status = 'completed'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `, [String(listRef || ''), String(userRef || '')]);

    return result.rows[0]?.snapshot_json || null;
  }

  async createShoppingSession(session) {
    this.requireDatabase();
    const client = await this.connect();

    try {
      await client.query('BEGIN');
      const userId = isUuid(session.userId) ? session.userId : null;
      await client.query(`
                INSERT INTO app.shopping_sessions (
                    id, comparison_run_id, comparison_plan_id, user_id, legacy_user_ref,
                    status, snapshot_json, created_at, updated_at
                ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb, $8, $8)
            `, [
        session.id, session.runId, session.planId, userId,
        userId ? null : String(session.userId || ''), session.status,
        JSON.stringify(session), session.createdAt,
      ]);

      let position = 0;

      for (const group of session.groups || []) {
        for (const item of group.items || []) {
          await client.query(`
                        INSERT INTO app.shopping_session_items (
                            session_id, line_item_id, de_product_id, product_name, image_url,
                            quantity, retailer_id, retailer_name, price_amount, currency,
                            product_url, checked, position, snapshot_json
                        ) VALUES (
                            $1::uuid, $2, $3::uuid, $4, $5, $6, $7::uuid, $8, $9, $10,
                            $11, $12, $13, $14::jsonb
                        )
                    `, [
            session.id, item.lineItemId || `${item.productId}:${position}`, item.productId,
            item.productName, item.imageUrl || null, item.quantity, item.retailerId,
            item.retailerName, item.price.amount, item.price.currency,
            item.productUrl || null, Boolean(item.checked), position, JSON.stringify(item),
          ]);
          position += 1;
        }
      }
      await client.query('COMMIT');

      return session;
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.source) error.source = 'app';
      throw error;
    } finally {
      client.release();
    }
  }

  async getShoppingSession(sessionId, userRef) {
    this.requireDatabase();
    const owner = String(userRef || '');
    const sessionResult = await this.query(`
            SELECT snapshot_json, status, created_at, updated_at
            FROM app.shopping_sessions
            WHERE id = $1::uuid
              AND (user_id::text = $2 OR legacy_user_ref = $2)
        `, [sessionId, owner]);
    if (!sessionResult.rows[0]) return null;
    const itemsResult = await this.query(`
            SELECT line_item_id, de_product_id, product_name, image_url, quantity,
                   retailer_id, retailer_name, price_amount, currency, product_url,
                   checked, position, snapshot_json
            FROM app.shopping_session_items
            WHERE session_id = $1::uuid
            ORDER BY position, id
        `, [sessionId]);

    return hydrateShoppingSession(sessionResult.rows[0], itemsResult.rows);
  }

  async updateShoppingSessionItem(sessionId, itemId, userRef, checked) {
    this.requireDatabase();
    const result = await this.query(`
            UPDATE app.shopping_session_items AS item
            SET checked = $4, updated_at = CURRENT_TIMESTAMP
            FROM app.shopping_sessions AS session
            WHERE item.session_id = session.id
              AND session.id = $1::uuid
              AND item.line_item_id = $2
              AND (session.user_id::text = $3 OR session.legacy_user_ref = $3)
            RETURNING item.id
        `, [sessionId, itemId, String(userRef || ''), checked]);
    if (!result.rows.length) return null;
    await this.query(`
            UPDATE app.shopping_sessions
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::uuid
        `, [sessionId]);

    return this.getShoppingSession(sessionId, userRef);
  }

  async resolveLegacyProductReferences(items) {
    if (!this.pool) return items;
    const legacyIds = items
      .map((item) => item.legacyProductId || item.id || item.productId)
      .filter((value) => value && !isUuid(value))
      .map(String);
    if (!legacyIds.length) return items;

    const mapped = new Map();

    try {
      const appMappings = await this.query(`
                SELECT source_ref, target_de_product_id
                FROM app.comparison_product_mappings
                WHERE source_ref = ANY($1::text[])
            `, [legacyIds]);
      appMappings.rows.forEach((row) => mapped.set(row.source_ref, String(row.target_de_product_id)));
    } catch (error) {
      if (error.code !== '42P01' && error.code !== '3F000') throw error;
    }

    try {
      const result = await this.query(`
                SELECT source_mongo_id, target_uuid
                FROM migration.entity_map
                WHERE source_collection = 'products'
                  AND target_table IN ('silver.dim_products', 'comparison_products')
                  AND source_mongo_id = ANY($1::text[])
                  AND migration_status = 'migrated'
            `, [legacyIds]);

      result.rows.forEach((row) => {
        if (!mapped.has(row.source_mongo_id)) mapped.set(row.source_mongo_id, String(row.target_uuid));
      });
    } catch (error) {
      if (error.code === '42P01' || error.code === '3F000') {
        // The migration-owned entity map is optional during the transition.
      } else {
        throw error;
      }
    }

    return items.map((item) => {
      const legacy = String(item.legacyProductId || item.id || item.productId || '');

      return mapped.has(legacy) ? { ...item, deProductId: mapped.get(legacy) } : item;
    });
  }

  async persistProductMappings(mappings) {
    if (!this.pool || !mappings.length) return;
    const client = await this.connect();

    try {
      await client.query('BEGIN');

      for (const mapping of mappings) {
        await client.query(`
                    INSERT INTO app.comparison_product_mappings (
                        source_ref, target_de_product_id, mapping_method, mapped_at
                    ) VALUES ($1, $2::uuid, $3, CURRENT_TIMESTAMP)
                    ON CONFLICT (source_ref) DO UPDATE
                    SET target_de_product_id = EXCLUDED.target_de_product_id,
                        mapping_method = EXCLUDED.mapping_method,
                        mapped_at = CURRENT_TIMESTAMP
                `, [mapping.sourceRef, mapping.targetProductId, mapping.mappingMethod]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.source) error.source = 'app';
      throw error;
    } finally {
      client.release();
    }
  }

  async recordSubstitutionDecision(decision) {
    this.requireDatabase();
    await this.query(`
            INSERT INTO app.comparison_substitution_decisions (
                id, run_id, replacement_run_id, user_id, legacy_user_ref,
                original_de_product_id, replacement_de_product_id, action, created_at
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7::uuid, $8, $9)
        `, [
      decision.id, decision.runId, decision.replacementRunId,
      isUuid(decision.userId) ? decision.userId : null,
      isUuid(decision.userId) ? null : String(decision.userId || ''),
      decision.originalProductId, decision.replacementProductId,
      decision.action, decision.createdAt,
    ]);
  }

  async recordEvents(events) {
    this.requireDatabase();
    const client = await this.connect();

    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(`
                    INSERT INTO app.comparison_events (
                        event_name, user_id, legacy_user_ref, anonymous_session_id,
                        occurred_at, properties
                    ) VALUES ($1, $2::uuid, $3, $4::uuid, $5, $6::jsonb)
                `, [
          event.name,
          isUuid(event.userRef) ? event.userRef : null,
          event.userRef && !isUuid(event.userRef) ? String(event.userRef) : null,
          isUuid(event.anonymousSessionId) ? event.anonymousSessionId : null,
          event.occurredAt,
          JSON.stringify(event.properties || {}),
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.source) error.source = 'app';
      throw error;
    } finally {
      client.release();
    }
  }

  async markShoppingStarted(runId, planId, userRef) {
    await this.recordEvents([{
      name: 'shopping_started',
      occurredAt: new Date().toISOString(),
      userRef,
      properties: { runId, planId },
    }]);
  }

  async connect() {
    this.requireDatabase();
    try {
      return await this.pool.connect();
    } catch (error) {
      if (!error.source) error.source = 'app';
      throw error;
    }
  }

  async query(sql, params) {
    this.requireDatabase();
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      if (!error.source) error.source = 'app';
      throw error;
    }
  }

  requireDatabase() {
    if (!this.pool) {
      const error = new Error('App comparison database is not configured');
      error.status = 503;
      error.source = 'app';
      throw error;
    }
  }
}

function hydrateShoppingSession(sessionRow, itemRows) {
  const snapshot = sessionRow.snapshot_json || {};
  const grouped = new Map();
  const groupSnapshots = new Map(
    (snapshot.groups || []).map((group) => [String(group.retailerName), group]),
  );

  for (const row of itemRows) {
    const retailerName = row.retailer_name || 'Retailer';
    grouped.set(retailerName, [...(grouped.get(retailerName) || []), {
      ...(row.snapshot_json || {}),
      lineItemId: row.line_item_id,
      productId: String(row.de_product_id),
      productName: row.product_name,
      imageUrl: row.image_url,
      quantity: row.quantity,
      retailerId: String(row.retailer_id),
      retailerName,
      price: { amount: Number(row.price_amount).toFixed(2), currency: row.currency },
      productUrl: row.product_url,
      checked: row.checked,
    }]);
  }

  return {
    ...snapshot,
    status: sessionRow.status,
    createdAt: new Date(sessionRow.created_at).toISOString(),
    updatedAt: new Date(sessionRow.updated_at).toISOString(),
    groups: Array.from(grouped, ([retailerName, items]) => ({
      ...(groupSnapshots.get(retailerName) || {}),
      retailerName,
      items,
    })),
  };
}

async function insertItemResult(client, runId, retailerResultId, item) {
  await client.query(`
        INSERT INTO app.comparison_item_results (
            run_id, retailer_result_id, line_item_id, de_product_id, product_name, quantity,
            retailer_id, retailer_name, price_amount, currency, product_url,
            observed_at, availability_source, snapshot_json
        ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7::uuid, $8, $9, $10, $11, $12, $13, $14::jsonb)
    `, [
    runId, retailerResultId, item.lineItemId || item.productId, item.productId, item.productName, item.quantity,
    item.retailerId, item.retailerName, item.price.amount, item.price.currency,
    item.productUrl, item.observedAt, 'latest_price_inference', JSON.stringify(item),
  ]);
}

module.exports = { AppComparisonRepository };

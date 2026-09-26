const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { DeComparisonRepository } = require('../src/comparison/repositories/de-comparison.repository');

const enabled = process.env.RUN_COMPARISON_POSTGRES_INTEGRATION === 'true';

test('DE comparison role uses a repeatable read-only snapshot and stable views', { skip: !enabled }, async () => {
    assert.ok(process.env.DE_DATABASE_URL, 'DE_DATABASE_URL is required');
    const pool = new Pool({ connectionString: process.env.DE_DATABASE_URL });
    try {
        const repository = new DeComparisonRepository(pool);
        await repository.withReadOnlySnapshot(async (snapshot) => {
            const settings = await snapshot.db.query(`
                SELECT current_setting('transaction_read_only') AS read_only,
                       current_setting('transaction_isolation') AS isolation
            `);
            assert.equal(settings.rows[0].read_only, 'on');
            assert.equal(settings.rows[0].isolation, 'repeatable read');
            const views = await snapshot.db.query(`
                SELECT table_name FROM information_schema.views
                WHERE table_schema = 'silver'
                  AND table_name = ANY($1::text[])
            `, [[
                'comparison_products',
                'comparison_latest_offers',
                'comparison_price_history',
            ]]);
            assert.equal(views.rowCount, 3);
        });
    } finally {
        await pool.end();
    }
});

test('App comparison snapshots reject update and rollback cleanly', { skip: !enabled }, async () => {
    assert.ok(process.env.APP_DATABASE_URL, 'APP_DATABASE_URL is required');
    const pool = new Pool({ connectionString: process.env.APP_DATABASE_URL });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        await client.query(`
            INSERT INTO app.comparison_runs (
                id, legacy_user_ref, legacy_list_ref, list_name, status,
                objective, max_retailers, calculation_policy_version, snapshot_json
            ) VALUES ($1::uuid, 'integration-user', 'integration-list', 'Integration',
                'completed', 'lowest_total', 1, 'test', '{}'::jsonb)
        `, [id]);
        await assert.rejects(
            client.query('UPDATE app.comparison_runs SET list_name = $2 WHERE id = $1::uuid', [id, 'Changed']),
            /immutable/i
        );
        await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
    }
});

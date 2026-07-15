import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const LEGACY_MIGRATION = '20260711000000_connectpath_twenty_foundation';
const LEGACY_MIGRATION_PATH = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  LEGACY_MIGRATION,
  'migration.sql'
);
const PRISMA_CLI_PATH = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const MIGRATION_LOCK_KEY = 'refferq-production-migrations';
const legacyBaseTables = ['users', 'affiliates', 'referrals', 'conversions', 'commissions'];

const expectedColumns = [
  ['referrals', 'customer_type'],
  ['referrals', 'business_name'],
  ['referrals', 'address_line_1'],
  ['referrals', 'address_line_2'],
  ['referrals', 'city'],
  ['referrals', 'state'],
  ['referrals', 'postal_code'],
  ['referrals', 'country_code'],
  ['referrals', 'move_in_date'],
  ['referrals', 'desired_install_date'],
  ['referrals', 'requested_services'],
  ['referrals', 'order_consent'],
  ['referrals', 'marketing_sms_consent'],
  ['referrals', 'consent_captured_at'],
  ['referrals', 'consent_source'],
  ['referrals', 'submitted_snapshot'],
  ['referrals', 'source_version'],
  ['referrals', 'sync_origin'],
  ['referrals', 'last_integration_event'],
  ['conversions', 'completion_key'],
  ['commissions', 'completion_key'],
];

const expectedTables = [
  'integration_outbox_events',
  'integration_delivery_attempts',
  'integration_object_maps',
  'inbound_integration_events',
  'integration_reconciliation_jobs',
  'commission_adjustments',
];

function runPrisma(args) {
  const result = spawnSync(process.execPath, [PRISMA_CLI_PATH, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Prisma command failed: prisma ${args.join(' ')}`);
  }
}

async function hasAppliedMigration(client, migrationName) {
  const tableResult = await client.query(
    `SELECT to_regclass('public._prisma_migrations')::text AS table_name`
  );
  if (!tableResult.rows[0]?.table_name) return false;

  const migrationResult = await client.query(
    `SELECT finished_at, rolled_back_at
       FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1`,
    [migrationName]
  );

  const migration = migrationResult.rows[0];
  return Boolean(migration?.finished_at && !migration?.rolled_back_at);
}

async function inspectLegacyMigrationObjects(client) {
  const columnConditions = expectedColumns
    .map((_, index) => `(table_name = $${index * 2 + 1} AND column_name = $${index * 2 + 2})`)
    .join(' OR ');
  const columnParameters = expectedColumns.flat();

  const [columnResult, tableResult] = await Promise.all([
    client.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (${columnConditions})`,
      columnParameters
    ),
    client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [expectedTables]
    ),
  ]);

  return {
    presentColumns: columnResult.rows.length,
    totalColumns: expectedColumns.length,
    presentTables: tableResult.rows.length,
    totalTables: expectedTables.length,
  };
}

async function countBaseTables(client) {
  const result = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [legacyBaseTables]
  );
  return result.rows.length;
}

function migrationObjectsAreAbsent(state) {
  return state.presentColumns === 0 && state.presentTables === 0;
}

function migrationObjectsAreComplete(state) {
  return state.presentColumns === state.totalColumns && state.presentTables === state.totalTables;
}

async function applyLegacyMigration(client) {
  const sql = await readFile(LEGACY_MIGRATION_PATH, 'utf8');

  console.log(`Applying legacy additive migration ${LEGACY_MIGRATION}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required for production migrations');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_KEY]);

    const migrationApplied = await hasAppliedMigration(client, LEGACY_MIGRATION);
    if (!migrationApplied) {
      const baseTableCount = await countBaseTables(client);
      if (baseTableCount === 0) {
        console.log('Empty production database detected; creating the current schema.');
        runPrisma(['db', 'push', '--skip-generate']);
      } else if (baseTableCount !== legacyBaseTables.length) {
        throw new Error(
          `Production database contains only ${baseTableCount}/${legacyBaseTables.length} base tables. ` +
          'Refusing to initialize or migrate a partial database.'
        );
      }

      let objectState = await inspectLegacyMigrationObjects(client);

      if (baseTableCount === legacyBaseTables.length && migrationObjectsAreAbsent(objectState)) {
        await applyLegacyMigration(client);
        objectState = await inspectLegacyMigrationObjects(client);
      }

      if (!migrationObjectsAreComplete(objectState)) {
        throw new Error(
          `Production schema is partially migrated (${objectState.presentColumns}/${objectState.totalColumns} columns, ` +
          `${objectState.presentTables}/${objectState.totalTables} tables). Refusing to guess or continue.`
        );
      }

      runPrisma([
        'migrate',
        'diff',
        '--from-schema-datasource',
        'prisma/schema.prisma',
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ]);
      runPrisma(['migrate', 'resolve', '--applied', LEGACY_MIGRATION]);
    }

    runPrisma(['migrate', 'deploy']);
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_KEY]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

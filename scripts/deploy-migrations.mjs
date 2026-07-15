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
const truncatedLegacyIndexName = 'integration_object_maps_provider_local_entity_type_local_entity';
const expectedLegacyIndexName = 'integration_object_maps_provider_local_entity_type_local_en_key';

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

function runPrisma(args, options = {}) {
  const captureOutput = Boolean(options.allowErrorCode);
  const result = spawnSync(process.execPath, [PRISMA_CLI_PATH, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: captureOutput ? 'pipe' : 'inherit',
    encoding: captureOutput ? 'utf8' : undefined,
  });

  if (result.error) throw result.error;
  if (captureOutput) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (options.allowErrorCode && output.includes(options.allowErrorCode)) {
      console.log(`Prisma reported ${options.allowErrorCode}; another deploy already completed this step.`);
      return;
    }
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
  await client.query(sql);
}

async function normalizeLegacyIndexNames(client) {
  const result = await client.query(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])`,
    [[truncatedLegacyIndexName, expectedLegacyIndexName]]
  );
  const indexNames = new Set(result.rows.map((row) => row.indexname));

  if (indexNames.has(truncatedLegacyIndexName) && !indexNames.has(expectedLegacyIndexName)) {
    console.log('Normalizing the legacy integration object-map index name.');
    await client.query(
      `ALTER INDEX "${truncatedLegacyIndexName}" RENAME TO "${expectedLegacyIndexName}"`
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required for production migrations');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let migrationNeedsBaseline = false;

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_LOCK_KEY]);

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

      await normalizeLegacyIndexNames(client);
      migrationNeedsBaseline = true;
    }

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration error if the connection has already closed.
    }
    throw error;
  } finally {
    await client.end();
  }

  if (migrationNeedsBaseline) {
    runPrisma([
      'migrate',
      'diff',
      '--from-schema-datasource',
      'prisma/schema.prisma',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--exit-code',
    ]);
    runPrisma(
      ['migrate', 'resolve', '--applied', LEGACY_MIGRATION],
      { allowErrorCode: 'P3008' }
    );
  }

  runPrisma(['migrate', 'deploy']);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

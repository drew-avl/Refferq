import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  TWENTY_SCHEMA_MANIFEST,
  type TwentyFieldManifest,
  type TwentyObjectManifest,
} from '../src/lib/integrations/twenty/schema-manifest';

type JsonObject = Record<string, unknown>;

interface CliOptions {
  mode: 'dry-run' | 'apply' | 'verify' | 'inventory';
  json: boolean;
  confirmWorkspace?: string;
}

export interface Inventory {
  workspace: { id: string | null; name: string | null };
  objects: JsonObject[];
  indexes: JsonObject[];
}

interface Change {
  action: 'create-object' | 'create-field' | 'create-index' | 'create-relation';
  object: string;
  name: string;
  payload: JsonObject;
}

interface Drift {
  object: string;
  field?: string;
  expected: unknown;
  actual: unknown;
  recommendation: string;
}

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseOptions(argv: string[]): CliOptions {
  let mode: CliOptions['mode'] = 'dry-run';
  let json = false;
  let confirmWorkspace: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') mode = 'dry-run';
    else if (arg === '--apply') mode = 'apply';
    else if (arg === '--verify') mode = 'verify';
    else if (arg === '--inventory') mode = 'inventory';
    else if (arg === '--json') json = true;
    else if (arg === '--confirm-workspace') confirmWorkspace = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { mode, json, confirmWorkspace };
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => !!item && typeof item === 'object');
  const object = asObject(value);
  for (const key of ['data', 'objects', 'objectMetadataItems', 'indexes', 'indexMetadataItems']) {
    if (Array.isArray(object[key])) return asArray(object[key]);
  }
  return [];
}

function asRecordArray(value: unknown): JsonObject[] {
  const direct = asArray(value);
  if (direct.length > 0) return direct;
  const root = asObject(value);
  for (const child of Object.values(asObject(root.data))) {
    if (Array.isArray(child)) return asArray(child).map((item) => asObject(item.node || item));
    const nested = asObject(child);
    if (Array.isArray(nested.edges)) return asArray(nested.edges).map((item) => asObject(item.node || item));
  }
  return [];
}

function extractCreated(value: unknown): JsonObject {
  const object = asObject(value);
  const data = asObject(object.data);
  return Object.keys(data).length ? data : object;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as JsonObject).map(([key, child]) => [
    key,
    /api.?key|secret|authorization|token/i.test(key) ? '[REDACTED]' : redact(child),
  ]));
}

class TwentyMetadataClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor() {
    const baseUrl = process.env.TWENTY_API_BASE_URL?.trim();
    const apiKey = process.env.TWENTY_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      throw new Error('TWENTY_API_BASE_URL and TWENTY_API_KEY are required for inventory, verify, and apply modes.');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = Number(process.env.TWENTY_API_TIMEOUT_MS || 15000);
  }

  async request(pathname: string, init: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const requestId = response.headers.get('x-request-id');
        throw new Error(`Twenty metadata ${init.method || 'GET'} ${pathname} returned ${response.status}${requestId ? ` (${requestId})` : ''}: ${JSON.stringify(redact(body))}`);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Twenty metadata request timed out after ${this.timeoutMs}ms: ${pathname}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async inventory(): Promise<Inventory> {
    const objectResponse = await this.request('/rest/metadata/objects');
    let indexes: JsonObject[] = [];
    try {
      indexes = asArray(await this.request('/rest/metadata/indexes'));
    } catch (error) {
      if (process.env.TWENTY_ALLOW_INDEX_INVENTORY_FALLBACK !== 'true') throw error;
    }
    const objects = asArray(objectResponse).sort((left, right) => String(left.nameSingular).localeCompare(String(right.nameSingular)));
    const root = asObject(objectResponse);
    const dataSource = asObject(objects[0]?.dataSource);
    const workspace = asObject(root.workspace);
    const id = String(root.workspaceId || workspace.id || dataSource.workspaceId || '') || null;
    const name = String(root.workspaceName || workspace.name || '') || null;
    const liveData = new Map<string, boolean>();
    for (const object of objects.filter((item) => ['referConnectReferral', 'referConnectReferralPartner', 'referConnectPayout'].includes(String(item.nameSingular)))) {
      const plural = String(object.namePlural || '');
      if (!plural) continue;
      const response = await this.request(`/rest/${encodeURIComponent(plural)}?limit=1`);
      liveData.set(String(object.nameSingular), asRecordArray(response).length > 0);
    }
    return {
      workspace: { id, name },
      objects: objects.map((object) => ({
        id: object.id,
        nameSingular: object.nameSingular,
        namePlural: object.namePlural,
        labelSingular: object.labelSingular,
        labelPlural: object.labelPlural,
        isCustom: object.isCustom,
        hasLiveData: liveData.get(String(object.nameSingular)) ?? null,
        fields: asArray(object.fields).sort((left, right) => String(left.name).localeCompare(String(right.name))),
      })),
      indexes: indexes.sort((left, right) => String(left.name).localeCompare(String(right.name))),
    };
  }

  createObject(object: TwentyObjectManifest) {
    return this.request('/rest/metadata/objects', {
      method: 'POST',
      body: JSON.stringify({
        nameSingular: object.nameSingular,
        namePlural: object.namePlural,
        labelSingular: object.labelSingular,
        labelPlural: object.labelPlural,
        icon: object.icon,
      }),
    });
  }

  createField(objectId: string, field: TwentyFieldManifest) {
    return this.request('/rest/metadata/fields', {
      method: 'POST',
      body: JSON.stringify({
        objectMetadataId: objectId,
        name: field.name,
        label: field.label,
        type: field.type,
        description: field.description,
        options: field.options,
        isNullable: true,
      }),
    });
  }

  createRelation(sourceObjectId: string, targetObjectId: string, sourceField: string, inverseField: string) {
    return this.request('/rest/metadata/fields', {
      method: 'POST',
      body: JSON.stringify({
        objectMetadataId: sourceObjectId,
        type: 'RELATION',
        name: sourceField,
        label: sourceField.replace(/([a-z])([A-Z])/g, '$1 $2'),
        relationDefinition: {
          relationType: 'MANY_TO_ONE',
          targetObjectMetadataId: targetObjectId,
          targetFieldLabel: inverseField.replace(/([a-z])([A-Z])/g, '$1 $2'),
          targetFieldName: inverseField,
        },
      }),
    });
  }

  createIndex(objectId: string, name: string, fieldIds: string[]) {
    return this.request('/rest/metadata/indexes', {
      method: 'POST',
      body: JSON.stringify({
        objectMetadataId: objectId,
        name,
        isUnique: true,
        indexFieldMetadataList: fieldIds.map((fieldMetadataId, order) => ({ fieldMetadataId, order })),
      }),
    });
  }
}

function findObject(inventory: Inventory, name: string) {
  return inventory.objects.find((object) => object.nameSingular === name || object.namePlural === name);
}

function objectFields(object: JsonObject | undefined): JsonObject[] {
  return asArray(object?.fields);
}

export function compareInventory(inventory: Inventory): { changes: Change[]; drift: Drift[] } {
  const changes: Change[] = [];
  const drift: Drift[] = [];
  for (const expectedObject of TWENTY_SCHEMA_MANIFEST.objects) {
    const actualObject = findObject(inventory, expectedObject.nameSingular);
    if (!actualObject) {
      if (expectedObject.builtIn) {
        drift.push({
          object: expectedObject.nameSingular,
          expected: 'built-in object', actual: 'missing',
          recommendation: 'Confirm that this is a supported Twenty workspace and API key before applying.',
        });
      } else {
        changes.push({ action: 'create-object', object: expectedObject.nameSingular, name: expectedObject.nameSingular, payload: { ...expectedObject } });
        for (const field of expectedObject.fields) {
          changes.push({ action: 'create-field', object: expectedObject.nameSingular, name: field.name, payload: { ...field } });
        }
        for (const index of expectedObject.uniqueIndexes || []) {
          changes.push({ action: 'create-index', object: expectedObject.nameSingular, name: index.name, payload: { fields: [...index.fields] } });
        }
      }
      continue;
    }
    const fields = objectFields(actualObject);
    for (const expectedField of expectedObject.fields) {
      const actualField = fields.find((field) => field.name === expectedField.name);
      if (!actualField) {
        changes.push({ action: 'create-field', object: expectedObject.nameSingular, name: expectedField.name, payload: { ...expectedField } });
      } else if (String(actualField.type) !== expectedField.type) {
        drift.push({
          object: expectedObject.nameSingular,
          field: expectedField.name,
          expected: expectedField.type,
          actual: actualField.type,
          recommendation: 'Create a compatible replacement field, migrate data, and update the manifest in a separately reviewed change.',
        });
      }
    }
    for (const index of expectedObject.uniqueIndexes || []) {
      if (!inventory.indexes.some((actualIndex) => actualIndex.name === index.name)) {
        changes.push({ action: 'create-index', object: expectedObject.nameSingular, name: index.name, payload: { fields: [...index.fields] } });
      }
    }
  }
  for (const [source, sourceField, target, inverseField] of TWENTY_SCHEMA_MANIFEST.relations) {
    const actualSource = findObject(inventory, source);
    const sourceExpected = TWENTY_SCHEMA_MANIFEST.objects.some((object) => object.nameSingular === source);
    const targetExpected = TWENTY_SCHEMA_MANIFEST.objects.some((object) => object.nameSingular === target);
    if (sourceExpected && targetExpected && (!actualSource || !objectFields(actualSource).some((field) => field.name === sourceField))) {
      changes.push({ action: 'create-relation', object: source, name: sourceField, payload: { target, inverseField } });
    }
  }
  return { changes, drift };
}

function confirmWorkspace(inventory: Inventory, expected?: string) {
  if (!expected) return;
  const normalized = expected.trim().toLowerCase();
  if (![inventory.workspace.id, inventory.workspace.name].filter(Boolean).some((value) => String(value).trim().toLowerCase() === normalized)) {
    throw new Error(`Configured Twenty workspace does not match --confirm-workspace ${expected}. Discovered ${inventory.workspace.id || 'unknown id'} / ${inventory.workspace.name || 'unknown name'}.`);
  }
}

async function applyChanges(client: TwentyMetadataClient, inventory: Inventory, changes: Change[]) {
  const objectByName = new Map(inventory.objects.map((object) => [String(object.nameSingular), object]));
  for (const change of changes.filter((item) => item.action === 'create-object')) {
    const manifest = TWENTY_SCHEMA_MANIFEST.objects.find((object) => object.nameSingular === change.object)!;
    const created = extractCreated(await client.createObject(manifest));
    objectByName.set(change.object, created);
  }
  for (const change of changes.filter((item) => item.action === 'create-field')) {
    const object = objectByName.get(change.object);
    const objectId = String(object?.id || '');
    if (!objectId) throw new Error(`Cannot create field ${change.object}.${change.name}: object metadata ID is missing.`);
    await client.createField(objectId, change.payload as unknown as TwentyFieldManifest);
  }
  // Refresh after fields so unique indexes can refer to real field metadata IDs.
  const refreshed = await client.inventory();
  for (const change of changes.filter((item) => item.action === 'create-relation')) {
    const source = findObject(refreshed, change.object);
    const target = findObject(refreshed, String(change.payload.target));
    if (!source?.id || !target?.id) throw new Error(`Cannot create relation ${change.object}.${change.name}: object metadata ID is missing.`);
    await client.createRelation(String(source.id), String(target.id), change.name, String(change.payload.inverseField));
  }
  const withRelations = await client.inventory();
  for (const change of changes.filter((item) => item.action === 'create-index')) {
    const object = findObject(withRelations, change.object);
    const fields = objectFields(object);
    const fieldIds = (change.payload.fields as string[]).map((fieldName) => {
      const field = fields.find((item) => item.name === fieldName);
      if (!field?.id) throw new Error(`Cannot create index ${change.name}: ${change.object}.${fieldName} has no metadata ID.`);
      return String(field.id);
    });
    await client.createIndex(String(object?.id), change.name, fieldIds);
  }
}

async function main() {
  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));
  const options = parseOptions(process.argv.slice(2));
  if (options.mode === 'dry-run' && !process.env.TWENTY_API_KEY) {
    const offline = {
      mode: 'dry-run', network: false, manifestVersion: TWENTY_SCHEMA_MANIFEST.version,
      objects: TWENTY_SCHEMA_MANIFEST.objects.map((object) => ({
        name: object.nameSingular, builtIn: !!object.builtIn, fields: object.fields.length,
        uniqueIndexes: object.uniqueIndexes?.length || 0,
      })),
      relations: TWENTY_SCHEMA_MANIFEST.relations.length,
      note: 'No API key configured; this is a non-mutating manifest plan. Configure Twenty to diff against a workspace.',
    };
    process.stdout.write(`${options.json ? JSON.stringify(offline, null, 2) : JSON.stringify(offline, null, 2)}\n`);
    return;
  }

  const client = new TwentyMetadataClient();
  const inventory = await client.inventory();
  confirmWorkspace(inventory, options.confirmWorkspace);
  if (options.mode === 'inventory') {
    process.stdout.write(`${JSON.stringify(redact(inventory), null, 2)}\n`);
    return;
  }

  const comparison = compareInventory(inventory);
  const report = { mode: options.mode, manifestVersion: TWENTY_SCHEMA_MANIFEST.version, workspace: inventory.workspace, ...comparison };
  if (options.mode === 'dry-run' || options.mode === 'verify') {
    process.stdout.write(`${JSON.stringify(redact(report), null, 2)}\n`);
    if (comparison.drift.length > 0 || (options.mode === 'verify' && comparison.changes.length > 0)) process.exitCode = 2;
    return;
  }

  if (!options.confirmWorkspace) throw new Error('--apply requires --confirm-workspace <id-or-name>.');
  if (comparison.drift.length > 0) {
    process.stdout.write(`${JSON.stringify(redact(report), null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  await applyChanges(client, inventory, comparison.changes);
  const verified = compareInventory(await client.inventory());
  process.stdout.write(`${JSON.stringify(redact({ ...report, applied: comparison.changes.length, verification: verified }), null, 2)}\n`);
  if (verified.changes.length > 0 || verified.drift.length > 0) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

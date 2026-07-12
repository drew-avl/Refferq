import assert from 'node:assert/strict';
import test from 'node:test';
import { compareInventory, type Inventory } from '../scripts/twenty-prepare';
import { TWENTY_SCHEMA_MANIFEST } from '../src/lib/integrations/twenty/schema-manifest';

function inventory(options: { complete?: boolean; incompatible?: boolean } = {}): Inventory {
  const relationFields = new Map<string, string[]>();
  for (const [source, field] of TWENTY_SCHEMA_MANIFEST.relations) {
    relationFields.set(source, [...(relationFields.get(source) || []), field]);
  }
  const objects = TWENTY_SCHEMA_MANIFEST.objects
    .filter((object) => options.complete || object.builtIn)
    .map((object, objectIndex) => ({
      id: `object-${objectIndex}`,
      nameSingular: object.nameSingular,
      namePlural: object.namePlural,
      fields: options.complete
        ? [
            ...object.fields.map((field, fieldIndex) => ({
              id: `field-${objectIndex}-${fieldIndex}`,
              name: field.name,
              type: options.incompatible && object.nameSingular === 'person' && field.name === 'sourceSystem' ? 'NUMBER' : field.type,
            })),
            ...(relationFields.get(object.nameSingular) || []).map((name) => ({ name, type: 'RELATION' })),
          ]
        : [],
    }));
  const indexes = options.complete
    ? TWENTY_SCHEMA_MANIFEST.objects.flatMap((object) => (object.uniqueIndexes || []).map((index) => ({ name: index.name })))
    : [];
  return { workspace: { id: 'workspace-1', name: 'Test' }, objects, indexes };
}

test('schema planner covers a clean workspace in one apply plan', () => {
  const result = compareInventory(inventory());
  assert.equal(result.drift.length, 0);
  for (const object of TWENTY_SCHEMA_MANIFEST.objects.filter((item) => !item.builtIn)) {
    assert.ok(result.changes.some((change) => change.action === 'create-object' && change.object === object.nameSingular));
    assert.equal(result.changes.filter((change) => change.action === 'create-field' && change.object === object.nameSingular).length, object.fields.length);
  }
  assert.equal(result.changes.filter((change) => change.action === 'create-relation').length, TWENTY_SCHEMA_MANIFEST.relations.length);
});

test('schema planner treats a complete workspace as a no-op', () => {
  const result = compareInventory(inventory({ complete: true }));
  assert.deepEqual(result, { changes: [], drift: [] });
});

test('schema planner blocks incompatible field drift', () => {
  const result = compareInventory(inventory({ complete: true, incompatible: true }));
  assert.equal(result.drift.length, 1);
  assert.equal(result.drift[0].object, 'person');
  assert.equal(result.drift[0].field, 'sourceSystem');
});


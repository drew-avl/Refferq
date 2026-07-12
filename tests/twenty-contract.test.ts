import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { TWENTY_SCHEMA_MANIFEST } from '../src/lib/integrations/twenty/schema-manifest';
import { verifyTwentyWebhookSignature } from '../src/lib/integrations/twenty/inbound';
import { normalizedAddressKey, normalizePhone } from '../src/lib/integrations/twenty/normalize';
import { providerAvailabilityKey, resolveProvider } from '../src/lib/integrations/twenty/providers';
import { referralSchema } from '../src/lib/validations';
import { validateConnectPathVisit } from '../src/lib/integrations/twenty/visits';

test('Twenty manifest has stable, unique object, field, relation, and index names', () => {
  const objectNames = TWENTY_SCHEMA_MANIFEST.objects.map((object) => object.nameSingular);
  assert.equal(new Set(objectNames).size, objectNames.length);
  for (const object of TWENTY_SCHEMA_MANIFEST.objects) {
    const fieldNames = object.fields.map((field) => field.name);
    assert.equal(new Set(fieldNames).size, fieldNames.length, `${object.nameSingular} has duplicate field names`);
    for (const field of object.fields) {
      for (const option of field.options || []) assert.match(option.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    for (const index of object.uniqueIndexes || []) {
      for (const field of index.fields) assert.ok(fieldNames.includes(field), `${index.name} references missing ${object.nameSingular}.${field}`);
    }
  }
  for (const [source, , target] of TWENTY_SCHEMA_MANIFEST.relations) {
    assert.ok(objectNames.includes(source), `relation source ${source} is missing`);
    assert.ok(objectNames.includes(target), `relation target ${target} is missing`);
  }
});

test('Twenty webhook signature validates raw body and rejects tampering and stale timestamps', () => {
  const rawBody = JSON.stringify({ event: 'opportunity.updated', data: { id: 'remote-1' } });
  const timestamp = '2026-07-11T16:00:00.000Z';
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex');
  assert.equal(verifyTwentyWebhookSignature({ rawBody, timestamp, signature, secret, now: new Date(timestamp) }).valid, true);
  assert.deepEqual(
    verifyTwentyWebhookSignature({ rawBody: `${rawBody} `, timestamp, signature, secret, now: new Date(timestamp) }),
    { valid: false, reason: 'invalid-signature' },
  );
  assert.deepEqual(
    verifyTwentyWebhookSignature({ rawBody, timestamp, signature, secret, now: new Date('2026-07-11T16:10:00.000Z'), replayWindowSeconds: 300 }),
    { valid: false, reason: 'stale-timestamp' },
  );
});

test('residential and business referral contracts validate without forcing Company on residents', () => {
  const common = {
    leadName: 'Jane Smith', leadEmail: '', leadPhone: '(828) 555-0100',
    address: '100 Main Street', address2: '', programId: 'program-1',
  };
  assert.equal(referralSchema.safeParse({ ...common, customerType: 'RESIDENTIAL' }).success, true);
  assert.equal(referralSchema.safeParse({
    ...common, customerType: 'BUSINESS', businessName: 'Acme LLC',
    desiredInstallDate: '2026-08-01', requestedServices: ['PRIMARY_INTERNET', 'VOICE'],
  }).success, true);
  assert.equal(referralSchema.safeParse({ ...common, customerType: 'BUSINESS' }).success, false);
  assert.equal(referralSchema.safeParse({ ...common, leadPhone: '', leadEmail: '' }).success, false);
});

test('address, phone, provider aliases, and availability keys normalize deterministically', () => {
  assert.equal(normalizePhone('(828) 555-0100'), '+18285550100');
  const first = normalizedAddressKey({ addressLine1: '100 Main St.', addressLine2: '4B', city: 'Asheville', state: 'NC', postalCode: '28801' });
  const second = normalizedAddressKey({ addressLine1: '100 MAIN ST', addressLine2: '4-B', city: 'ASHEVILLE', state: 'nc', postalCode: '28801', countryCode: 'US' });
  assert.equal(first, second);
  assert.equal(resolveProvider('AT&T Fiber')?.slug, 'att');
  assert.equal(resolveProvider('Comcast Business')?.slug, 'xfinity');
  assert.equal(providerAvailabilityKey('location-1', 'att', 'FIBER'), providerAvailabilityKey('location-1', 'att', 'FIBER'));
});

test('visit contract enforces relationship and conditional fields', () => {
  const valid = validateConnectPathVisit({
    visitDate: '2026-07-11T15:00:00.000Z', propertyId: 'property-1',
    personSpokenToId: 'person-1', relatedPersonIds: ['person-1'], summary: 'Met leasing team.',
    followUpRequired: true, followUpDate: '2026-07-12T15:00:00.000Z',
    referralReceived: true, referralId: 'referral-1',
  });
  assert.equal(valid.valid, true);
  const invalid = validateConnectPathVisit({
    visitDate: 'invalid', personSpokenToId: 'unrelated', relatedPersonIds: [], summary: '',
    followUpRequired: true, referralReceived: true,
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 6);
});

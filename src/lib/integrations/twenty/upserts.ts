import { prisma } from '@/lib/prisma';
import { getTwentyManifestObject } from './schema-manifest';
import { TwentyApiClient } from './client';
import { normalizeEmail, normalizePhone, normalizedAddressKey, splitName } from './normalize';
import { providerAvailabilityKey, resolveProvider } from './providers';

type JsonObject = Record<string, unknown>;

export interface OutboxEnvelope {
  contractVersion: number;
  eventId: string;
  event: string;
  source: string;
  sourceVersion: number;
  occurredAt: string;
  entity: string;
  entityId: string;
  data: JsonObject;
}

export interface TwentyDeliveryResult {
  statusCode: number;
  requestId?: string;
  response: string;
  created: number;
  updated: number;
  unchanged: number;
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function iso(value: unknown) {
  const candidate = text(value);
  if (!candidate) return null;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function existingMap(localEntityType: string, localEntityId: string, remoteObject: string) {
  return prisma.integrationObjectMap.findUnique({
    where: {
      provider_localEntityType_localEntityId_remoteObject: {
        provider: 'twenty', localEntityType, localEntityId, remoteObject,
      },
    },
  });
}

async function saveMap(options: {
  localEntityType: string;
  localEntityId: string;
  remoteObject: string;
  remoteId: string;
  sourceVersion: number;
  eventId: string;
}) {
  return prisma.integrationObjectMap.upsert({
    where: {
      provider_localEntityType_localEntityId_remoteObject: {
        provider: 'twenty',
        localEntityType: options.localEntityType,
        localEntityId: options.localEntityId,
        remoteObject: options.remoteObject,
      },
    },
    create: {
      provider: 'twenty', ...options, lastEventId: options.eventId, lastSyncedAt: new Date(),
    },
    update: {
      remoteId: options.remoteId, sourceVersion: options.sourceVersion,
      lastEventId: options.eventId, lastSyncedAt: new Date(),
    },
  });
}

async function mappedUpsert(options: {
  client: TwentyApiClient;
  envelope: OutboxEnvelope;
  localEntityType: string;
  localEntityId: string;
  remoteObject: string;
  uniqueField: string;
  uniqueValue: string;
  data: JsonObject;
}) {
  const mapping = await existingMap(options.localEntityType, options.localEntityId, options.remoteObject);
  if (mapping && mapping.sourceVersion > options.envelope.sourceVersion) {
    return { id: mapping.remoteId, created: false, unchanged: true, status: 200, requestId: undefined, responseText: 'stale source version ignored' };
  }
  const manifest = getTwentyManifestObject(options.remoteObject);
  const payload = {
    ...options.data,
    sourceSystem: 'refferq',
    sourceExternalId: options.localEntityId,
    sourceVersion: options.envelope.sourceVersion,
    lastSourceSyncAt: new Date().toISOString(),
    lastEventId: options.envelope.eventId,
    syncOrigin: 'refferq',
  };
  const result = mapping?.remoteId
    ? await options.client.update(manifest.namePlural, mapping.remoteId, payload).then((response) => ({
        id: mapping.remoteId, created: false, unchanged: false, status: response.status,
        requestId: response.requestId, responseText: response.responseText,
      }))
    : await options.client.upsert(manifest.namePlural, options.uniqueField, options.uniqueValue, payload).then((response) => ({ ...response, unchanged: false }));
  await saveMap({
    localEntityType: options.localEntityType,
    localEntityId: options.localEntityId,
    remoteObject: options.remoteObject,
    remoteId: result.id,
    sourceVersion: options.envelope.sourceVersion,
    eventId: options.envelope.eventId,
  });
  return result;
}

function summary(results: Array<{ created: boolean; unchanged: boolean; status: number; requestId?: string; responseText: string }>): TwentyDeliveryResult {
  return {
    statusCode: results.reduce((highest, item) => Math.max(highest, item.status), 200),
    requestId: results.map((item) => item.requestId).filter(Boolean).at(-1),
    response: results.map((item) => item.responseText).filter(Boolean).at(-1) || '',
    created: results.filter((item) => item.created).length,
    updated: results.filter((item) => !item.created && !item.unchanged).length,
    unchanged: results.filter((item) => item.unchanged).length,
  };
}

export async function deliverPartnerEnvelope(client: TwentyApiClient, envelope: OutboxEnvelope) {
  const eventData = envelope.data;
  const partner = object(eventData.referralPartner);
  const partnerId = text(partner.id || envelope.entityId);
  const name = splitName(text(partner.name));
  const person = await mappedUpsert({
    client, envelope, localEntityType: 'referral_partner', localEntityId: partnerId,
    remoteObject: 'person', uniqueField: 'refferqAffiliateId', uniqueValue: partnerId,
    data: {
      name, emails: { primaryEmail: normalizeEmail(text(partner.email)), additionalEmails: [] },
      refferqAffiliateId: partnerId, contactTypes: ['REFERRAL_PARTNER'],
    },
  });
  const partnerGroup = object(eventData.partnerGroup);
  const programs = Array.isArray(eventData.programs) ? eventData.programs.map(object) : [];
  const profile = await mappedUpsert({
    client, envelope, localEntityType: 'referral_partner', localEntityId: partnerId,
    remoteObject: 'referConnectReferralPartner', uniqueField: 'referralPartnerId', uniqueValue: partnerId,
    data: {
      name: text(partner.name), referralPartnerId: partnerId, email: normalizeEmail(text(partner.email)),
      status: text(partner.status), partnerGroup: text(partnerGroup.name),
      programSummary: programs.map((program) => text(program.name)).filter(Boolean).join(', '),
      referralCount: Number(partner.referralCount || 0), balanceCents: Number(partner.balanceCents || 0),
      payoutMethod: text(partner.payoutMethod), portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/partners/${partnerId}`,
      personId: person.id,
    },
  });
  return summary([person, profile]);
}

export async function deliverReferralEnvelope(client: TwentyApiClient, envelope: OutboxEnvelope) {
  const eventData = envelope.data;
  const referral = object(eventData.referral);
  const partner = object(eventData.partner);
  const program = object(eventData.program);
  const referralId = text(referral.id || envelope.entityId);
  const customerType = text(referral.customerType || 'RESIDENTIAL').toUpperCase() === 'BUSINESS' ? 'BUSINESS' : 'RESIDENTIAL';
  const results: Array<{ id: string; created: boolean; unchanged: boolean; status: number; requestId?: string; responseText: string }> = [];

  const customerName = splitName(text(referral.leadName));
  const person = await mappedUpsert({
    client, envelope, localEntityType: 'referral_customer', localEntityId: referralId,
    remoteObject: 'person', uniqueField: 'sourceExternalId', uniqueValue: `referral:${referralId}:person`,
    data: {
      name: customerName,
      emails: { primaryEmail: normalizeEmail(text(referral.leadEmail)), additionalEmails: [] },
      phones: { primaryPhoneNumber: normalizePhone(text(referral.leadPhone)), primaryPhoneCallingCode: '', additionalPhones: [] },
      contactTypes: [customerType === 'BUSINESS' ? 'BUSINESS_CONTACT' : 'RESIDENT'],
      orderConsent: Boolean(referral.orderConsent), marketingSmsConsent: Boolean(referral.marketingSmsConsent),
      consentCapturedAt: iso(referral.consentCapturedAt), consentSource: text(referral.consentSource),
    },
  });
  results.push(person);

  let companyId: string | null = null;
  const businessName = text(referral.businessName || referral.company);
  if (customerType === 'BUSINESS' && businessName) {
    const company = await mappedUpsert({
      client, envelope, localEntityType: 'referral_company', localEntityId: referralId,
      remoteObject: 'company', uniqueField: 'sourceExternalId', uniqueValue: `referral:${referralId}:company`,
      data: { name: businessName, companyTypes: ['BUSINESS_CUSTOMER'] },
    });
    companyId = company.id;
    results.push(company);
  }

  const address = {
    addressLine1: text(referral.addressLine1 || referral.address),
    addressLine2: text(referral.addressLine2 || referral.unitOrApartment),
    city: text(referral.city), state: text(referral.state), postalCode: text(referral.postalCode),
    countryCode: text(referral.countryCode || 'US'),
  };
  const addressKey = normalizedAddressKey(address);
  const location = await mappedUpsert({
    client, envelope, localEntityType: 'service_location', localEntityId: referralId,
    remoteObject: 'connectPathServiceLocation', uniqueField: 'normalizedAddressKey', uniqueValue: addressKey,
    data: {
      name: [address.addressLine1, address.addressLine2].filter(Boolean).join(' '), normalizedAddressKey: addressKey,
      ...address, locationType: customerType === 'BUSINESS' ? 'BUSINESS_LOCATION' : 'RESIDENT_UNIT',
      residentId: person.id, ...(companyId ? { companyId } : {}),
    },
  });
  results.push(location);

  let propertyId: string | null = null;
  const programId = text(program.id);
  if (programId) {
    const property = await mappedUpsert({
      client, envelope, localEntityType: 'program', localEntityId: programId,
      remoteObject: 'connectPathProperty', uniqueField: 'refferqProgramId', uniqueValue: programId,
      data: {
        name: text(program.name), propertyKey: `refferq-program:${programId}`, refferqProgramId: programId,
        refferqProgramName: text(program.name), status: program.isActive === false ? 'INACTIVE' : 'ACTIVE_PARTNER',
      },
    });
    propertyId = property.id;
    results.push(property);
  }

  let partnerProfileId: string | null = null;
  const partnerId = text(partner.id);
  if (partnerId) {
    const mapping = await existingMap('referral_partner', partnerId, 'referConnectReferralPartner');
    partnerProfileId = mapping?.remoteId || null;
  }

  const remoteReferral = await mappedUpsert({
    client, envelope, localEntityType: 'referral', localEntityId: referralId,
    remoteObject: 'referConnectReferral', uniqueField: 'referralId', uniqueValue: referralId,
    data: {
      name: `${text(referral.leadName)} — ${referralId.slice(-6)}`, referralId, customerType,
      refferqStatus: text(referral.status), crmStatus: text(referral.status),
      refferqProgramId: programId, refferqProgramName: text(program.name), submittedAt: iso(referral.createdAt),
      moveInDate: iso(referral.moveInDate)?.slice(0, 10), desiredInstallDate: iso(referral.desiredInstallDate)?.slice(0, 10),
      requestedServiceTypes: Array.isArray(referral.requestedServices) ? referral.requestedServices : [],
      notes: text(referral.notes), customerPersonId: person.id, serviceLocationId: location.id,
      ...(companyId ? { customerCompanyId: companyId } : {}), ...(propertyId ? { propertyId } : {}),
      ...(partnerProfileId ? { referralPartnerId: partnerProfileId } : {}),
    },
  });
  results.push(remoteReferral);

  const opportunity = await mappedUpsert({
    client, envelope, localEntityType: 'referral', localEntityId: referralId,
    remoteObject: 'opportunity', uniqueField: 'refferqReferralId', uniqueValue: referralId,
    data: {
      name: `${text(referral.leadName)} — ConnectPath`, refferqReferralId: referralId, customerType,
      connectPathStage: text(referral.status) === 'SOLD' ? 'ORDER' : text(referral.status) === 'COMPLETED' ? 'COMMISSION' : 'LEAD',
      referConnectReferralId: remoteReferral.id, serviceLocationId: location.id,
      ...(companyId ? { companyId } : {}), ...(propertyId ? { propertyId } : {}),
      ...(partnerProfileId ? { referralPartnerId: partnerProfileId } : {}),
    },
  });
  results.push(opportunity);
  return summary(results);
}

export async function deliverPayoutEnvelope(client: TwentyApiClient, envelope: OutboxEnvelope) {
  const eventData = envelope.data;
  const payout = object(eventData.payout);
  const payoutId = text(payout.id || envelope.entityId);
  const partnerId = text(payout.affiliateId);
  const mapping = partnerId ? await existingMap('referral_partner', partnerId, 'referConnectReferralPartner') : null;
  const result = await mappedUpsert({
    client, envelope, localEntityType: 'payout', localEntityId: payoutId,
    remoteObject: 'referConnectPayout', uniqueField: 'payoutId', uniqueValue: payoutId,
    data: {
      name: `Payout ${payoutId.slice(-8)}`, payoutId, amountCents: Number(payout.amountCents || 0),
      currency: text(payout.currency || 'USD'), commissionCount: Number(payout.commissionCount || 0),
      status: text(payout.status), method: text(payout.method), processedAt: iso(payout.processedAt),
      ...(mapping ? { referralPartnerId: mapping.remoteId } : {}),
    },
  });
  return summary([result]);
}

export async function upsertProviderAvailability(options: {
  client: TwentyApiClient;
  envelope: OutboxEnvelope;
  serviceLocationRemoteId: string;
  providerName: string;
  serviceType: string;
  availabilityStatus: string;
  fields?: JsonObject;
}) {
  const provider = resolveProvider(options.providerName);
  if (!provider) throw new Error(`Unknown provider alias: ${options.providerName}`);
  const company = await mappedUpsert({
    client: options.client, envelope: options.envelope, localEntityType: 'provider', localEntityId: provider.slug,
    remoteObject: 'company', uniqueField: 'providerSlug', uniqueValue: provider.slug,
    data: { name: provider.name, providerSlug: provider.slug, companyTypes: ['PROVIDER_CARRIER'] },
  });
  const key = providerAvailabilityKey(options.serviceLocationRemoteId, provider.slug, options.serviceType);
  return mappedUpsert({
    client: options.client, envelope: options.envelope, localEntityType: 'provider_availability', localEntityId: key,
    remoteObject: 'connectPathProviderAvailability', uniqueField: 'availabilityKey', uniqueValue: key,
    data: {
      name: `${provider.name} — ${options.serviceType}`, availabilityKey: key,
      availabilityStatus: options.availabilityStatus, serviceTypes: [options.serviceType],
      serviceLocationId: options.serviceLocationRemoteId, providerId: company.id, ...options.fields,
    },
  });
}

export async function deliverEnvelope(client: TwentyApiClient, envelope: OutboxEnvelope) {
  if (envelope.entity === 'referral') return deliverReferralEnvelope(client, envelope);
  if (envelope.entity === 'referral_partner') return deliverPartnerEnvelope(client, envelope);
  if (envelope.entity === 'payout') return deliverPayoutEnvelope(client, envelope);
  throw new Error(`No Twenty delivery handler for entity ${envelope.entity}.`);
}


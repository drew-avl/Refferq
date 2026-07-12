import crypto from 'node:crypto';

export const TWENTY_SCHEMA_VERSION = 1;

export type TwentyFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_TIME'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'CURRENCY'
  | 'RELATION';

export interface TwentySelectOption {
  id: string;
  value: string;
  label: string;
  color: string;
  position: number;
}

export interface TwentyFieldManifest {
  name: string;
  label: string;
  type: TwentyFieldType;
  description?: string;
  options?: readonly TwentySelectOption[];
  relation?: {
    targetObject: string;
    type: 'MANY_TO_ONE' | 'ONE_TO_MANY';
    inverseField: string;
  };
}

export interface TwentyObjectManifest {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  builtIn?: boolean;
  fields: readonly TwentyFieldManifest[];
  uniqueIndexes?: readonly { name: string; fields: readonly string[] }[];
  views?: readonly string[];
}

function optionId(value: string) {
  const hex = crypto.createHash('sha256').update(`connectpath:${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const option = (value: string, label: string, position: number, color = 'blue'): TwentySelectOption => ({
  id: optionId(value),
  value,
  label,
  color,
  position,
});

const sourceFields: readonly TwentyFieldManifest[] = [
  { name: 'sourceSystem', label: 'Source System', type: 'TEXT' },
  { name: 'sourceExternalId', label: 'Source External ID', type: 'TEXT' },
  { name: 'sourceVersion', label: 'Source Version', type: 'NUMBER' },
  { name: 'lastSourceSyncAt', label: 'Last Source Sync At', type: 'DATE_TIME' },
  { name: 'lastEventId', label: 'Last Event ID', type: 'TEXT' },
  { name: 'syncOrigin', label: 'Sync Origin', type: 'TEXT' },
];

export const TWENTY_SCHEMA_MANIFEST = {
  version: TWENTY_SCHEMA_VERSION,
  namespace: 'connectpath',
  objects: [
    {
      nameSingular: 'person',
      namePlural: 'people',
      labelSingular: 'Person',
      labelPlural: 'People',
      icon: 'IconUser',
      builtIn: true,
      fields: [
        { name: 'contactTypes', label: 'Contact Types', type: 'MULTI_SELECT', options: [
          option('RESIDENT', 'Resident', 0), option('REFERRAL_PARTNER', 'Referral Partner', 1),
          option('LEASING_AGENT', 'Leasing Agent', 2), option('PROPERTY_MANAGER', 'Property Manager', 3),
          option('REAL_ESTATE_AGENT', 'Real Estate Agent', 4), option('BUSINESS_CONTACT', 'Business Contact', 5),
          option('OTHER', 'Other', 6),
        ] },
        { name: 'refferqAffiliateId', label: 'Refferq Affiliate ID', type: 'TEXT' },
        { name: 'orderConsent', label: 'Order Consent', type: 'BOOLEAN' },
        { name: 'marketingSmsConsent', label: 'Marketing SMS Consent', type: 'BOOLEAN' },
        { name: 'consentCapturedAt', label: 'Consent Captured At', type: 'DATE_TIME' },
        { name: 'consentSource', label: 'Consent Source', type: 'TEXT' },
        ...sourceFields,
      ],
      uniqueIndexes: [
        { name: 'connectpath_person_refferq_affiliate_id_unique', fields: ['refferqAffiliateId'] },
        { name: 'connectpath_person_source_external_id_unique', fields: ['sourceExternalId'] },
      ],
    },
    {
      nameSingular: 'company',
      namePlural: 'companies',
      labelSingular: 'Company',
      labelPlural: 'Companies',
      icon: 'IconBuilding',
      builtIn: true,
      fields: [
        { name: 'companyTypes', label: 'Company Types', type: 'MULTI_SELECT', options: [
          option('BUSINESS_CUSTOMER', 'Business Customer', 0), option('PROPERTY_MANAGEMENT', 'Property Management', 1),
          option('REFERRAL_PARTNER_ORGANIZATION', 'Referral Partner Organization', 2),
          option('PROVIDER_CARRIER', 'Provider / Carrier', 3), option('PROPERTY_OWNER', 'Property Owner', 4),
          option('OTHER', 'Other', 5),
        ] },
        { name: 'providerSlug', label: 'Provider Slug', type: 'TEXT' },
        { name: 'serviceProviders', label: 'Service Providers', type: 'MULTI_SELECT', options: [] },
        ...sourceFields,
      ],
      uniqueIndexes: [
        { name: 'connectpath_company_source_external_id_unique', fields: ['sourceSystem', 'sourceExternalId'] },
        { name: 'connectpath_company_provider_slug_unique', fields: ['providerSlug'] },
      ],
    },
    {
      nameSingular: 'connectPathProperty', namePlural: 'connectPathProperties',
      labelSingular: 'Property', labelPlural: 'Properties', icon: 'IconBuildingEstate',
      fields: [
        { name: 'propertyKey', label: 'Property Key', type: 'TEXT' },
        { name: 'propertyType', label: 'Property Type', type: 'SELECT', options: [
          option('MULTIFAMILY', 'Multifamily', 0), option('SINGLE_FAMILY', 'Single Family', 1),
          option('MIXED_USE', 'Mixed Use', 2), option('COMMERCIAL', 'Commercial', 3), option('OTHER', 'Other', 4),
        ] },
        { name: 'status', label: 'Status', type: 'SELECT', options: [
          option('PROSPECT', 'Prospect', 0), option('ACTIVE_PARTNER', 'Active Partner', 1, 'green'),
          option('INACTIVE', 'Inactive', 2, 'gray'), option('DO_NOT_CONTACT', 'Do Not Contact', 3, 'red'),
        ] },
        { name: 'unitCount', label: 'Unit Count', type: 'NUMBER' },
        { name: 'refferqProgramId', label: 'Refferq Program ID', type: 'TEXT' },
        { name: 'refferqProgramName', label: 'Refferq Program Name', type: 'TEXT' },
        { name: 'serviceProviders', label: 'Service Providers', type: 'MULTI_SELECT', options: [] },
        { name: 'lastAvailabilityVerifiedAt', label: 'Last Availability Verified At', type: 'DATE_TIME' },
        ...sourceFields,
      ],
      uniqueIndexes: [
        { name: 'connectpath_property_key_unique', fields: ['propertyKey'] },
        { name: 'connectpath_property_program_id_unique', fields: ['refferqProgramId'] },
      ],
      views: ['Properties', 'Active Properties', 'Stale Qualifications'],
    },
    {
      nameSingular: 'connectPathServiceLocation', namePlural: 'connectPathServiceLocations',
      labelSingular: 'Service Location', labelPlural: 'Service Locations', icon: 'IconMapPin',
      fields: [
        { name: 'normalizedAddressKey', label: 'Normalized Address Key', type: 'TEXT' },
        { name: 'addressLine1', label: 'Address', type: 'TEXT' }, { name: 'addressLine2', label: 'Unit / Suite', type: 'TEXT' },
        { name: 'city', label: 'City', type: 'TEXT' }, { name: 'state', label: 'State', type: 'TEXT' },
        { name: 'postalCode', label: 'Postal Code', type: 'TEXT' }, { name: 'countryCode', label: 'Country', type: 'TEXT' },
        { name: 'latitude', label: 'Latitude', type: 'NUMBER' }, { name: 'longitude', label: 'Longitude', type: 'NUMBER' },
        { name: 'locationType', label: 'Location Type', type: 'SELECT', options: [
          option('PROPERTY_MAIN_ADDRESS', 'Property Main Address', 0), option('RESIDENT_UNIT', 'Resident Unit', 1),
          option('BUSINESS_LOCATION', 'Business Location', 2), option('HOME', 'Home', 3), option('OTHER', 'Other', 4),
        ] },
        ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'connectpath_service_location_address_unique', fields: ['normalizedAddressKey'] }],
      views: ['Business Locations', 'Resident Units'],
    },
    {
      nameSingular: 'connectPathProviderAvailability', namePlural: 'connectPathProviderAvailabilities',
      labelSingular: 'Provider Availability', labelPlural: 'Provider Availability', icon: 'IconAntennaBars5',
      fields: [
        { name: 'availabilityKey', label: 'Availability Key', type: 'TEXT' },
        { name: 'availabilityStatus', label: 'Availability Status', type: 'SELECT', options: [
          option('AVAILABLE', 'Available', 0, 'green'), option('UNAVAILABLE', 'Unavailable', 1, 'red'),
          option('CONSTRUCTION_REQUIRED', 'Construction Required', 2, 'orange'), option('PLANNED', 'Planned', 3),
          option('UNKNOWN', 'Unknown', 4, 'gray'),
        ] },
        { name: 'serviceTypes', label: 'Service Types', type: 'MULTI_SELECT', options: [
          option('FIBER', 'Fiber', 0), option('CABLE', 'Cable', 1), option('DSL', 'DSL', 2),
          option('FIXED_WIRELESS', 'Fixed Wireless', 3), option('CELLULAR', '5G / LTE', 4),
          option('SATELLITE', 'Satellite', 5), option('VOICE', 'Voice', 6),
        ] },
        { name: 'maxDownloadMbps', label: 'Max Download Mbps', type: 'NUMBER' },
        { name: 'maxUploadMbps', label: 'Max Upload Mbps', type: 'NUMBER' },
        { name: 'symmetrical', label: 'Symmetrical', type: 'BOOLEAN' },
        { name: 'planName', label: 'Plan / Offer', type: 'TEXT' }, { name: 'priceNotes', label: 'Price Notes', type: 'TEXT' },
        { name: 'constructionStatus', label: 'Construction Status', type: 'TEXT' },
        { name: 'constructionNotes', label: 'Construction Notes', type: 'TEXT' },
        { name: 'qualificationSource', label: 'Qualification Source', type: 'TEXT' },
        { name: 'evidenceReference', label: 'Evidence Reference', type: 'TEXT' },
        { name: 'verifiedAt', label: 'Verified At', type: 'DATE_TIME' }, { name: 'verifiedBy', label: 'Verified By', type: 'TEXT' },
        { name: 'staleAfter', label: 'Stale After', type: 'DATE_TIME' }, ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'connectpath_provider_availability_key_unique', fields: ['availabilityKey'] }],
      views: ['Available Providers', 'Construction Required', 'Stale Qualifications'],
    },
    {
      nameSingular: 'referConnectReferralPartner', namePlural: 'referConnectReferralPartners',
      labelSingular: 'Referral Partner', labelPlural: 'Referral Partners', icon: 'IconUsers',
      fields: [
        { name: 'referralPartnerId', label: 'Refferq Partner ID', type: 'TEXT' },
        { name: 'email', label: 'Email', type: 'TEXT' }, { name: 'status', label: 'Portal Status', type: 'TEXT' },
        { name: 'partnerGroup', label: 'Partner Group', type: 'TEXT' }, { name: 'programSummary', label: 'Programs', type: 'TEXT' },
        { name: 'partnerPriority', label: 'Partner Priority', type: 'SELECT', options: [
          option('HIGH', 'High', 0, 'red'), option('NORMAL', 'Normal', 1), option('LOW', 'Low', 2, 'gray'),
        ] },
        { name: 'relationshipStatus', label: 'Relationship Status', type: 'TEXT' },
        { name: 'lastVisitAt', label: 'Last Visit', type: 'DATE_TIME' }, { name: 'nextFollowUpAt', label: 'Next Follow-up', type: 'DATE_TIME' },
        { name: 'referralCount', label: 'Referral Count', type: 'NUMBER' }, { name: 'balanceCents', label: 'Balance Cents', type: 'NUMBER' },
        { name: 'payoutMethod', label: 'Payout Method', type: 'TEXT' }, { name: 'portalUrl', label: 'Portal URL', type: 'TEXT' },
        ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'referconnect_referral_partner_id_unique', fields: ['referralPartnerId'] }],
    },
    {
      nameSingular: 'connectPathPartnerAssignment', namePlural: 'connectPathPartnerAssignments',
      labelSingular: 'Partner Assignment', labelPlural: 'Partner Assignments', icon: 'IconUserCheck',
      fields: [
        { name: 'assignmentKey', label: 'Assignment Key', type: 'TEXT' },
        { name: 'role', label: 'Role', type: 'TEXT' }, { name: 'priority', label: 'Priority', type: 'NUMBER' },
        { name: 'active', label: 'Active', type: 'BOOLEAN' }, { name: 'primaryContact', label: 'Primary Contact', type: 'BOOLEAN' },
        { name: 'startDate', label: 'Start Date', type: 'DATE' }, { name: 'endDate', label: 'End Date', type: 'DATE' },
        { name: 'refferqProgramId', label: 'Refferq Program ID', type: 'TEXT' }, ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'connectpath_partner_assignment_key_unique', fields: ['assignmentKey'] }],
    },
    {
      nameSingular: 'referConnectReferral', namePlural: 'referConnectReferrals',
      labelSingular: 'Referral', labelPlural: 'Referrals', icon: 'IconAffiliate',
      fields: [
        { name: 'referralId', label: 'Refferq Referral ID', type: 'TEXT' },
        { name: 'customerType', label: 'Customer Type', type: 'SELECT', options: [
          option('RESIDENTIAL', 'Residential', 0), option('BUSINESS', 'Business', 1),
        ] },
        { name: 'refferqStatus', label: 'Refferq Status', type: 'TEXT' }, { name: 'crmStatus', label: 'CRM Referral Status', type: 'TEXT' },
        { name: 'refferqProgramId', label: 'Refferq Program ID', type: 'TEXT' },
        { name: 'refferqProgramName', label: 'Refferq Program Name', type: 'TEXT' },
        { name: 'submittedAt', label: 'Submitted At', type: 'DATE_TIME' }, { name: 'moveInDate', label: 'Move-in Date', type: 'DATE' },
        { name: 'desiredInstallDate', label: 'Desired Install Date', type: 'DATE' },
        { name: 'orderDate', label: 'Order Date', type: 'DATE_TIME' }, { name: 'installDate', label: 'Install Date', type: 'DATE_TIME' },
        { name: 'activationDate', label: 'Activation Date', type: 'DATE_TIME' },
        { name: 'requestedServiceTypes', label: 'Requested Services', type: 'MULTI_SELECT', options: [
          option('PRIMARY_INTERNET', 'Primary Internet', 0), option('BACKUP_INTERNET', 'Backup Internet', 1), option('VOICE', 'Voice', 2),
        ] },
        { name: 'requestedProvider', label: 'Requested Provider', type: 'TEXT' }, { name: 'notes', label: 'Notes', type: 'TEXT' },
        { name: 'rejectionReason', label: 'Rejection Reason', type: 'TEXT' }, { name: 'syncError', label: 'Sync Error', type: 'TEXT' },
        ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'referconnect_referral_id_unique', fields: ['referralId'] }],
      views: ['Referral List'],
    },
    {
      nameSingular: 'referConnectPayout', namePlural: 'referConnectPayouts',
      labelSingular: 'Payout', labelPlural: 'Payouts', icon: 'IconCash',
      fields: [
        { name: 'payoutId', label: 'Refferq Payout ID', type: 'TEXT' },
        { name: 'amountCents', label: 'Amount Cents', type: 'NUMBER' }, { name: 'currency', label: 'Currency', type: 'TEXT' },
        { name: 'commissionCount', label: 'Commission Count', type: 'NUMBER' }, { name: 'status', label: 'Status', type: 'TEXT' },
        { name: 'method', label: 'Method', type: 'TEXT' }, { name: 'processedAt', label: 'Processed At', type: 'DATE_TIME' },
        ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'referconnect_payout_id_unique', fields: ['payoutId'] }],
      views: ['Payouts'],
    },
    {
      nameSingular: 'connectPathVisit', namePlural: 'connectPathVisits',
      labelSingular: 'Visit', labelPlural: 'Visits', icon: 'IconWalk',
      fields: [
        { name: 'visitKey', label: 'Visit Key', type: 'TEXT' },
        { name: 'visitDate', label: 'Visit Date', type: 'DATE_TIME' }, { name: 'visitContext', label: 'Visit Context', type: 'TEXT' },
        { name: 'visitPurpose', label: 'Visit Purpose', type: 'TEXT' }, { name: 'visitOutcome', label: 'Visit Outcome', type: 'TEXT' },
        { name: 'summary', label: 'Summary', type: 'TEXT' }, { name: 'nextSteps', label: 'Next Steps', type: 'TEXT' },
        { name: 'followUpRequired', label: 'Follow-up Required', type: 'BOOLEAN' }, { name: 'followUpDate', label: 'Follow-up Date', type: 'DATE_TIME' },
        { name: 'providerDiscussed', label: 'Provider Discussed', type: 'TEXT' }, { name: 'referralReceived', label: 'Referral Received', type: 'BOOLEAN' },
        ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'connectpath_visit_key_unique', fields: ['visitKey'] }],
      views: ["Today's Visits", 'Follow-up Required', 'Property Visits', 'Business Visits', 'Visits With Referral'],
    },
    {
      nameSingular: 'opportunity', namePlural: 'opportunities', labelSingular: 'Opportunity', labelPlural: 'Opportunities',
      icon: 'IconTargetArrow', builtIn: true,
      fields: [
        { name: 'refferqReferralId', label: 'Refferq Referral ID', type: 'TEXT' },
        { name: 'customerType', label: 'Customer Type', type: 'SELECT', options: [option('RESIDENTIAL', 'Residential', 0), option('BUSINESS', 'Business', 1)] },
        { name: 'connectPathStage', label: 'ConnectPath Stage', type: 'SELECT', options: [
          option('LEAD', 'Lead', 0), option('QUALIFICATION', 'Qualification', 1), option('RECOMMENDATION', 'Recommendation', 2),
          option('ORDER', 'Order', 3), option('ACTIVATION', 'Activation', 4), option('COMMISSION', 'Commission', 5),
          option('SUPPORT', 'Support', 6), option('RENEWAL', 'Renewal', 7), option('CLOSED_LOST', 'Closed Lost', 8, 'red'),
        ] },
        { name: 'requestedServiceTypes', label: 'Requested Services', type: 'MULTI_SELECT', options: [] },
        { name: 'recommendedPlan', label: 'Recommended Plan', type: 'TEXT' }, { name: 'downloadMbps', label: 'Download Mbps', type: 'NUMBER' },
        { name: 'uploadMbps', label: 'Upload Mbps', type: 'NUMBER' }, { name: 'providerOrderId', label: 'Provider Order ID', type: 'TEXT' },
        { name: 'orderConfirmedAt', label: 'Order Confirmed At', type: 'DATE_TIME' },
        { name: 'installAppointment', label: 'Install Appointment', type: 'DATE_TIME' },
        { name: 'activationDate', label: 'Activation Date', type: 'DATE_TIME' }, { name: 'activationVerified', label: 'Activation Verified', type: 'BOOLEAN' },
        { name: 'chargebackDeadline', label: 'Chargeback Deadline', type: 'DATE' }, { name: 'chargebackStatus', label: 'Chargeback Status', type: 'TEXT' },
        { name: 'contractEnd', label: 'Contract End', type: 'DATE' }, { name: 'renewalDate', label: 'Renewal Date', type: 'DATE' },
        { name: 'rejectionReason', label: 'Closed Lost Reason', type: 'TEXT' }, ...sourceFields,
      ],
      uniqueIndexes: [{ name: 'connectpath_opportunity_referral_id_unique', fields: ['refferqReferralId'] }],
    },
  ] satisfies readonly TwentyObjectManifest[],
  relations: [
    ['referConnectReferral', 'customerPerson', 'person', 'referrals'],
    ['referConnectReferral', 'customerCompany', 'company', 'referrals'],
    ['referConnectReferral', 'serviceLocation', 'connectPathServiceLocation', 'referrals'],
    ['referConnectReferral', 'property', 'connectPathProperty', 'referrals'],
    ['referConnectReferral', 'referralPartner', 'referConnectReferralPartner', 'referrals'],
    ['referConnectReferral', 'opportunity', 'opportunity', 'referConnectReferral'],
    ['referConnectReferralPartner', 'person', 'person', 'referralPartnerProfile'],
    ['referConnectReferralPartner', 'organization', 'company', 'referralPartnerProfiles'],
    ['referConnectPayout', 'referralPartner', 'referConnectReferralPartner', 'payouts'],
    ['connectPathPartnerAssignment', 'referralPartner', 'referConnectReferralPartner', 'assignments'],
    ['connectPathPartnerAssignment', 'property', 'connectPathProperty', 'partnerAssignments'],
    ['connectPathServiceLocation', 'property', 'connectPathProperty', 'serviceLocations'],
    ['connectPathServiceLocation', 'company', 'company', 'serviceLocations'],
    ['connectPathServiceLocation', 'resident', 'person', 'serviceLocations'],
    ['connectPathProviderAvailability', 'serviceLocation', 'connectPathServiceLocation', 'providerAvailabilities'],
    ['connectPathProviderAvailability', 'provider', 'company', 'providerAvailabilities'],
    ['connectPathVisit', 'property', 'connectPathProperty', 'visits'],
    ['connectPathVisit', 'company', 'company', 'visits'],
    ['connectPathVisit', 'personSpokenTo', 'person', 'visits'],
    ['connectPathVisit', 'referral', 'referConnectReferral', 'visits'],
    ['connectPathVisit', 'opportunity', 'opportunity', 'visits'],
    ['opportunity', 'serviceLocation', 'connectPathServiceLocation', 'opportunities'],
    ['opportunity', 'property', 'connectPathProperty', 'opportunities'],
    ['opportunity', 'referralPartner', 'referConnectReferralPartner', 'opportunities'],
  ] as const,
} as const;

export type TwentyManifestObjectName = typeof TWENTY_SCHEMA_MANIFEST.objects[number]['nameSingular'];

export function getTwentyManifestObject(name: string): TwentyObjectManifest {
  const object = TWENTY_SCHEMA_MANIFEST.objects.find((item) => item.nameSingular === name);
  if (!object) throw new Error(`Unknown Twenty manifest object: ${name}`);
  return object;
}

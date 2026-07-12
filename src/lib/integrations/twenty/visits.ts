import { syntheticKey } from './normalize';

export interface ConnectPathVisitInput {
  visitDate: string;
  companyId?: string | null;
  propertyId?: string | null;
  personSpokenToId?: string | null;
  relatedPersonIds: readonly string[];
  visitContext?: string;
  visitPurpose?: string;
  visitOutcome?: string;
  summary: string;
  nextSteps?: string;
  followUpRequired: boolean;
  followUpDate?: string | null;
  providerDiscussed?: string;
  referralReceived: boolean;
  referralId?: string | null;
}

export function validateConnectPathVisit(input: ConnectPathVisitInput) {
  const errors: string[] = [];
  if (!input.companyId && !input.propertyId) errors.push('A Company or Property is required.');
  if (input.personSpokenToId && !input.relatedPersonIds.includes(input.personSpokenToId)) {
    errors.push('Person Spoken To must be related to the selected Company or Property.');
  }
  if (input.followUpRequired && !input.followUpDate) errors.push('Follow-up Date is required when follow-up is required.');
  if (input.referralReceived && !input.referralId) errors.push('A Referral must be selected or created when Referral Received is true.');
  const visitDate = new Date(input.visitDate);
  if (Number.isNaN(visitDate.getTime())) errors.push('Visit Date is invalid.');
  if (!input.summary.trim()) errors.push('Summary is required.');
  return { valid: errors.length === 0, errors };
}

export function connectPathVisitKey(input: Pick<ConnectPathVisitInput, 'visitDate' | 'companyId' | 'propertyId' | 'personSpokenToId'>) {
  return syntheticKey(input.visitDate, input.companyId, input.propertyId, input.personSpokenToId);
}


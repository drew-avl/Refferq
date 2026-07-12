import { z } from 'zod';
import { PAYOUT_METHODS } from './payout-methods';

export const payoutMethodSchema = z.enum(PAYOUT_METHODS);

// Referral Validation
export const referralSchema = z.object({
    customerType: z.enum(['RESIDENTIAL', 'BUSINESS']).default('RESIDENTIAL'),
    leadName: z.string().min(2, 'Name must be at least 2 characters'),
    leadEmail: z.union([z.string().email('Invalid email address'), z.literal('')]).default(''),
    leadPhone: z.string().max(30, 'Phone number is too long').default(''),
    address: z.string().min(5, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().length(2).default('US'),
    moveInDate: z.string().optional(),
    desiredInstallDate: z.string().optional(),
    programId: z.string().optional(),
    company: z.string().optional(),
    businessName: z.string().optional(),
    requestedServices: z.array(z.enum(['PRIMARY_INTERNET', 'BACKUP_INTERNET', 'VOICE'])).default([]),
    orderConsent: z.boolean().default(false),
    marketingSmsConsent: z.boolean().default(false),
    consentSource: z.string().optional(),
    notes: z.string().optional(),
    estimatedValue: z.coerce.number().min(0).max(999999999).optional(),
}).superRefine((data, context) => {
    if (!data.leadEmail.trim() && data.leadPhone.replace(/\D/g, '').length < 7) {
        context.addIssue({ code: 'custom', path: ['leadEmail'], message: 'Provide an email address or phone number' });
    }
    if (data.customerType === 'BUSINESS' && !(data.businessName || data.company)?.trim()) {
        context.addIssue({ code: 'custom', path: ['businessName'], message: 'Business name is required' });
    }
});

// Affiliate Creation Validation (Admin)
export const affiliateCreateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    company: z.string().optional(),
    payoutMethod: payoutMethodSchema.optional(),
    paypalEmail: z.string().max(200, 'Payout account is too long').optional().or(z.literal('')),
    sendWelcomeEmail: z.boolean().optional(),
    assignedProgramIds: z.array(z.string()).optional(),
    assignedStaffUserIds: z.array(z.string()).optional(),
});

export const affiliateUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    company: z.string().optional(),
    payoutMethod: payoutMethodSchema.optional(),
    paypalEmail: z.string().max(200, 'Payout account is too long').optional().or(z.literal('')),
    assignedProgramIds: z.array(z.string()).optional(),
    assignedStaffUserIds: z.array(z.string()).optional(),
});

// Payout Validation
export const payoutSchema = z.object({
    affiliateId: z.string(),
    commissionIds: z.array(z.string()).min(1, 'At least one commission is required'),
    method: payoutMethodSchema.optional(),
    notes: z.string().optional(),
});

// Payout Status Update Validation
export const payoutUpdateSchema = z.object({
    id: z.string(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    method: payoutMethodSchema.optional(),
    notes: z.string().optional(),
});

// Program Settings Validation
export const programSettingsSchema = z.object({
    productName: z.string().min(1),
    programName: z.string().min(1),
    websiteUrl: z.string().url(),
    currency: z.string().length(3),
    minPayoutCents: z.number().min(0),
    cookieDuration: z.number().int().min(1),
});

import { NextRequest, NextResponse } from 'next/server';

// Auto-generated OpenAPI spec from Zod schemas
export async function GET(request: NextRequest) {
    const spec = {
        openapi: '3.0.3',
        info: {
            title: 'ReferConnect API',
            version: '1.1.0',
            description: 'Open-source referral program platform API. Manage referral partners, referrals, conversions, commissions, and payouts.',
            contact: { email: 'hello@referconnect.com' },
            license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
        },
        servers: [
            { url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.referconnect.com', description: 'Production' },
        ],
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Referral Partner', description: 'Referral partner-facing endpoints' },
            { name: 'Admin', description: 'Admin management endpoints' },
            { name: 'Tracking', description: 'Click and conversion tracking' },
            { name: 'Webhooks', description: 'External webhook receivers' },
        ],
        paths: {
            // ─── Auth ──────────────────────────────────────────────
            '/api/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
                    },
                    responses: {
                        '200': { description: 'JWT token returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
                        '401': { description: 'Invalid credentials' },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    tags: ['Auth'],
                    summary: 'Get current user',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'Current user info' } },
                },
            },

            // ─── Referral Partner ─────────────────────────────────
            '/api/affiliate/profile': {
                get: {
                    tags: ['Referral Partner'],
                    summary: 'Get referral partner profile & stats',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'Referral partner data, referrals, stats, currencySymbol' } },
                },
                put: {
                    tags: ['Referral Partner'],
                    summary: 'Update referral partner profile',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
                    },
                    responses: { '200': { description: 'Profile updated' } },
                },
            },
            '/api/affiliate/referrals': {
                post: {
                    tags: ['Referral Partner'],
                    summary: 'Submit a new referral lead',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ReferralRequest' } } },
                    },
                    responses: {
                        '201': { description: 'Referral created' },
                        '400': { description: 'Validation error' },
                    },
                },
            },
            '/api/affiliate/payouts': {
                get: {
                    tags: ['Referral Partner'],
                    summary: 'Get referral partner payout history',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'List of payouts' } },
                },
            },

            // ─── Admin ─────────────────────────────────────────────
            '/api/admin/affiliates': {
                get: {
                    tags: ['Admin'],
                    summary: 'List all referral partners',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'Array of referral partners with stats and currencySymbol' } },
                },
                post: {
                    tags: ['Admin'],
                    summary: 'Create a new referral partner',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AffiliateCreateRequest' } } },
                    },
                    responses: {
                        '200': { description: 'Referral partner created, temporaryPassword included' },
                        '400': { description: 'Validation error or email exists' },
                    },
                },
            },
            '/api/admin/payouts': {
                get: {
                    tags: ['Admin'],
                    summary: 'List all payouts',
                    security: [{ BearerAuth: [] }],
                    parameters: [
                        { name: 'affiliateId', in: 'query', schema: { type: 'string' }, description: 'Filter by referral partner' },
                        { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv'] }, description: 'Export as CSV' },
                    ],
                    responses: { '200': { description: 'Array of payouts' } },
                },
                post: {
                    tags: ['Admin'],
                    summary: 'Create a payout',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/PayoutRequest' } } },
                    },
                    responses: { '200': { description: 'Payout created' } },
                },
                put: {
                    tags: ['Admin'],
                    summary: 'Update payout status',
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/PayoutUpdateRequest' } } },
                    },
                    responses: { '200': { description: 'Payout updated' } },
                },
            },
            '/api/admin/analytics': {
                get: {
                    tags: ['Admin'],
                    summary: 'Get platform analytics',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'Analytics data' } },
                },
            },
            '/api/admin/reports': {
                get: {
                    tags: ['Admin'],
                    summary: 'Get platform reports',
                    security: [{ BearerAuth: [] }],
                    responses: { '200': { description: 'Report data' } },
                },
            },

            // ─── Tracking ──────────────────────────────────────────
            '/r/{code}': {
                get: {
                    tags: ['Tracking'],
                    summary: 'Referral redirect (deep linking supported)',
                    parameters: [
                        { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'Referral code' },
                        { name: 'dest', in: 'query', schema: { type: 'string', format: 'uri' }, description: 'Deep link destination URL' },
                    ],
                    responses: {
                        '302': { description: 'Redirects to target URL with ref and attr params, sets attribution cookie' },
                    },
                },
            },

            // ─── Webhooks ──────────────────────────────────────────
            '/api/webhook/conversion': {
                post: {
                    tags: ['Webhooks'],
                    summary: 'Receive conversion events from external services',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/ConversionWebhook' } } },
                    },
                    responses: { '200': { description: 'Conversion processed' } },
                },
            },
        },
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        token: { type: 'string' },
                        user: { $ref: '#/components/schemas/UserSummary' },
                    },
                },
                UserSummary: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', enum: ['ADMIN', 'AFFILIATE'] },
                    },
                },
                ReferralRequest: {
                    type: 'object',
                    required: ['leadName', 'leadEmail'],
                    properties: {
                        leadName: { type: 'string', minLength: 2 },
                        leadEmail: { type: 'string', format: 'email' },
                        company: { type: 'string' },
                        notes: { type: 'string' },
                        estimatedValue: { type: 'number', minimum: 0 },
                    },
                },
                AffiliateCreateRequest: {
                    type: 'object',
                    required: ['name', 'email'],
                    properties: {
                        name: { type: 'string', minLength: 2 },
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8, description: 'Optional — auto-generated if omitted' },
                    },
                },
                PayoutRequest: {
                    type: 'object',
                    required: ['affiliateId', 'commissionIds'],
                    properties: {
                        affiliateId: { type: 'string' },
                        commissionIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
                        method: { type: 'string', enum: ['PayPal', 'Zelle'] },
                        notes: { type: 'string' },
                    },
                },
                PayoutUpdateRequest: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string' },
                        status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
                        method: { type: 'string', enum: ['PayPal', 'Zelle'] },
                        notes: { type: 'string' },
                    },
                },
                UpdateProfileRequest: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        company: { type: 'string' },
                        country: { type: 'string' },
                        paymentMethod: { type: 'string', enum: ['PayPal', 'Zelle'] },
                        paymentEmail: { type: 'string', description: 'Payout email or phone' },
                    },
                },
                ProgramSettingsRequest: {
                    type: 'object',
                    required: ['productName', 'programName', 'websiteUrl', 'currency', 'minPayoutCents', 'cookieDuration'],
                    properties: {
                        productName: { type: 'string', minLength: 1 },
                        programName: { type: 'string', minLength: 1 },
                        websiteUrl: { type: 'string', format: 'uri' },
                        currency: { type: 'string', minLength: 3, maxLength: 3 },
                        minPayoutCents: { type: 'integer', minimum: 0 },
                        cookieDuration: { type: 'integer', minimum: 1 },
                    },
                },
                ConversionWebhook: {
                    type: 'object',
                    properties: {
                        referralCode: { type: 'string' },
                        eventType: { type: 'string', enum: ['SIGNUP', 'PURCHASE', 'TRIAL', 'LEAD'] },
                        amountCents: { type: 'integer' },
                        currency: { type: 'string' },
                        customerEmail: { type: 'string', format: 'email' },
                    },
                },
            },
        },
    };

    return NextResponse.json(spec, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
    });
}

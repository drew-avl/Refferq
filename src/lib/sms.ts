type SmsProvider = 'voipms' | '3cx';

export interface SmsResult {
  success: boolean;
  message: string;
  provider?: SmsProvider;
}

export interface SmsBatchResult {
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  results: SmsResult[];
}

const VOIPMS_ENDPOINT = 'https://voip.ms/api/v1/rest.php';

function isSmsEnabled() {
  return process.env.SMS_ENABLED === 'true';
}

function splitList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+') && digits.length >= 11) return digits;

  const numeric = digits.replace(/\D/g, '');
  if (numeric.length === 10) return `+1${numeric}`;
  if (numeric.length >= 11) return `+${numeric}`;

  return null;
}

function normalizeVoipMsNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function getAdminSmsRecipients() {
  return Array.from(new Set(splitList(process.env.ADMIN_SMS_NUMBERS).map(normalizePhone).filter(Boolean))) as string[];
}

export function getAffiliateSmsRecipient(payoutDetails: unknown) {
  if (!payoutDetails || typeof payoutDetails !== 'object' || Array.isArray(payoutDetails)) {
    return null;
  }

  const details = payoutDetails as Record<string, unknown>;
  const candidates = [
    details.notificationPhone,
    details.smsPhone,
    details.phone,
    details.paymentPhone,
    details.paymentEmail,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }

  return null;
}

class SmsService {
  private getProviders(): SmsProvider[] {
    const configured = (process.env.SMS_PROVIDER || '').toLowerCase();
    if (configured === 'both') return ['voipms', '3cx'];
    if (configured === 'voipms' || configured === '3cx') return [configured];

    const providers: SmsProvider[] = [];
    if (process.env.VOIPMS_API_USERNAME && process.env.VOIPMS_API_PASSWORD && process.env.VOIPMS_SMS_DID) {
      providers.push('voipms');
    }
    if (process.env.THREECX_SMS_WEBHOOK_URL) {
      providers.push('3cx');
    }

    return providers;
  }

  private async sendViaVoipMs(to: string, message: string): Promise<SmsResult> {
    const username = process.env.VOIPMS_API_USERNAME;
    const password = process.env.VOIPMS_API_PASSWORD;
    const did = process.env.VOIPMS_SMS_DID;

    if (!username || !password || !did) {
      return { success: false, provider: 'voipms', message: 'VoIP.ms SMS credentials are not configured' };
    }

    const body = new URLSearchParams({
      api_username: username,
      api_password: password,
      method: 'sendSMS',
      did: normalizeVoipMsNumber(did),
      dst: normalizeVoipMsNumber(to),
      message,
      format: 'json',
    });

    const response = await fetch(process.env.VOIPMS_API_ENDPOINT || VOIPMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = await response.json().catch(() => null);
    const status = String(payload?.status || '').toLowerCase();

    if (response.ok && (status === 'success' || status === 'ok')) {
      return { success: true, provider: 'voipms', message: 'SMS sent through VoIP.ms' };
    }

    return {
      success: false,
      provider: 'voipms',
      message: payload?.status || payload?.error || `VoIP.ms SMS failed with HTTP ${response.status}`,
    };
  }

  private async sendViaThreeCx(to: string, message: string): Promise<SmsResult> {
    const url = process.env.THREECX_SMS_WEBHOOK_URL;
    if (!url) {
      return { success: false, provider: '3cx', message: '3CX SMS webhook URL is not configured' };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.THREECX_SMS_WEBHOOK_TOKEN) {
      headers.Authorization = `Bearer ${process.env.THREECX_SMS_WEBHOOK_TOKEN}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: process.env.THREECX_SMS_FROM || process.env.VOIPMS_SMS_DID || '',
        to,
        message,
      }),
    });

    if (response.ok) {
      return { success: true, provider: '3cx', message: 'SMS sent through 3CX webhook' };
    }

    const errorText = await response.text().catch(() => '');
    return {
      success: false,
      provider: '3cx',
      message: errorText || `3CX SMS webhook failed with HTTP ${response.status}`,
    };
  }

  async sendSms(to: string | null | undefined, message: string): Promise<SmsResult> {
    if (!isSmsEnabled()) {
      return { success: true, message: 'SMS disabled' };
    }

    const recipient = normalizePhone(to);
    if (!recipient) {
      return { success: false, message: 'SMS recipient phone number is invalid or missing' };
    }

    const providers = this.getProviders();
    if (providers.length === 0) {
      return { success: false, message: 'No SMS provider is configured' };
    }

    const failures: SmsResult[] = [];
    for (const provider of providers) {
      try {
        const result = provider === 'voipms'
          ? await this.sendViaVoipMs(recipient, message)
          : await this.sendViaThreeCx(recipient, message);
        if (result.success) return result;
        failures.push(result);
      } catch (error) {
        failures.push({
          success: false,
          provider,
          message: error instanceof Error ? error.message : 'SMS provider failed',
        });
      }
    }

    return {
      success: false,
      provider: failures[0]?.provider,
      message: failures.map((failure) => failure.message).join('; ') || 'SMS delivery failed',
    };
  }

  async sendBatch(recipients: string[], message: string): Promise<SmsBatchResult> {
    const uniqueRecipients = Array.from(new Set(recipients.map(normalizePhone).filter(Boolean))) as string[];

    if (uniqueRecipients.length === 0) {
      return { success: true, sent: 0, failed: 0, skipped: recipients.length, results: [] };
    }

    const results = await Promise.all(uniqueRecipients.map((recipient) => this.sendSms(recipient, message)));
    const sent = results.filter((result) => result.success).length;
    const failed = results.length - sent;

    return {
      success: failed === 0,
      sent,
      failed,
      skipped: recipients.length - uniqueRecipients.length,
      results,
    };
  }

  async sendAdminAlert(message: string) {
    return this.sendBatch(getAdminSmsRecipients(), message);
  }

  async sendAffiliateAlert(payoutDetails: unknown, message: string) {
    const recipient = getAffiliateSmsRecipient(payoutDetails);
    return this.sendSms(recipient, message);
  }
}

export const smsService = new SmsService();

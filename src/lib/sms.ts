type SmsProvider = 'voipms' | '3cx' | 'relay';

interface VoipMsResponsePayload {
  status?: string;
  error?: string;
  message?: string;
}

interface SmsRelayResponsePayload {
  success?: boolean;
  message?: string;
  provider?: string;
}

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
export const SMS_MESSAGE_MAX_LENGTH = 160;
const MAX_PROVIDER_DETAIL_LENGTH = 700;

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

function compactProviderDetail(value: string | null | undefined) {
  if (!value) return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > MAX_PROVIDER_DETAIL_LENGTH
    ? `${compact.slice(0, MAX_PROVIDER_DETAIL_LENGTH)}...`
    : compact;
}

export function compactSmsMessage(value: string) {
  const compact = (value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= SMS_MESSAGE_MAX_LENGTH) return compact;
  return compact.slice(0, SMS_MESSAGE_MAX_LENGTH).trimEnd();
}

function parseVoipMsResponse(rawBody: string): VoipMsResponsePayload | null {
  if (!rawBody) return null;

  try {
    const payload = JSON.parse(rawBody) as VoipMsResponsePayload;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function formatVoipMsFailure(response: Response, rawBody: string, payload: VoipMsResponsePayload | null) {
  const providerDetail = compactProviderDetail(
    payload?.error || payload?.message || payload?.status || rawBody
  );
  const baseMessage = response.ok
    ? 'VoIP.ms SMS request was rejected'
    : `VoIP.ms SMS failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;

  return providerDetail ? `${baseMessage}: ${providerDetail}` : baseMessage;
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
    const configuredProviders = splitList(configured)
      .filter((provider): provider is SmsProvider | 'both' => (
        provider === 'voipms' ||
        provider === '3cx' ||
        provider === 'relay' ||
        provider === 'both'
      ));

    if (configuredProviders.includes('both')) return ['voipms', '3cx'];
    if (configuredProviders.length > 0) return Array.from(new Set(configuredProviders)) as SmsProvider[];

    const providers: SmsProvider[] = [];
    if (process.env.SMS_RELAY_URL && process.env.SMS_RELAY_TOKEN) {
      providers.push('relay');
    }
    if (process.env.VOIPMS_API_USERNAME && process.env.VOIPMS_API_PASSWORD && process.env.VOIPMS_SMS_DID) {
      providers.push('voipms');
    }
    if (process.env.THREECX_SMS_WEBHOOK_URL) {
      providers.push('3cx');
    }

    return providers;
  }

  private async sendViaRelay(to: string, message: string): Promise<SmsResult> {
    const url = process.env.SMS_RELAY_URL;
    const token = process.env.SMS_RELAY_TOKEN;

    if (!url || !token) {
      return { success: false, provider: 'relay', message: 'SMS relay URL or token is not configured' };
    }

    const timeoutMs = Number(process.env.SMS_RELAY_TIMEOUT_MS || '10000');
    const controller = new AbortController();
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, message }),
        signal: controller.signal,
      });

      const rawBody = await response.text().catch(() => '');
      let payload: SmsRelayResponsePayload | null = null;
      try {
        payload = rawBody ? JSON.parse(rawBody) as SmsRelayResponsePayload : null;
      } catch {
        payload = null;
      }

      if (response.ok && payload?.success) {
        return { success: true, provider: 'relay', message: payload.message || 'SMS sent through relay' };
      }

      const detail = compactProviderDetail(payload?.message || rawBody);
      return {
        success: false,
        provider: 'relay',
        message: detail
          ? `SMS relay failed with HTTP ${response.status}: ${detail}`
          : `SMS relay failed with HTTP ${response.status}`,
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async sendViaVoipMs(to: string, message: string): Promise<SmsResult> {
    const username = process.env.VOIPMS_API_USERNAME;
    const password = process.env.VOIPMS_API_PASSWORD;
    const did = process.env.VOIPMS_SMS_DID;

    if (!username || !password || !did) {
      return { success: false, provider: 'voipms', message: 'VoIP.ms SMS credentials are not configured' };
    }

    const url = new URL(process.env.VOIPMS_API_ENDPOINT || VOIPMS_ENDPOINT);
    const params = new URLSearchParams({
      api_username: username,
      api_password: password,
      method: 'sendSMS',
      did: normalizeVoipMsNumber(did),
      dst: normalizeVoipMsNumber(to),
      message,
      format: 'json',
    });
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), { method: 'GET' });

    const rawBody = await response.text().catch(() => '');
    const payload = parseVoipMsResponse(rawBody);
    const status = String(payload?.status || '').toLowerCase();

    if (response.ok && (status === 'success' || status === 'ok')) {
      return { success: true, provider: 'voipms', message: 'SMS sent through VoIP.ms' };
    }

    return {
      success: false,
      provider: 'voipms',
      message: formatVoipMsFailure(response, rawBody, payload),
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

    const smsMessage = compactSmsMessage(message);
    if (!smsMessage) {
      return { success: false, message: 'SMS message is empty' };
    }

    const failures: SmsResult[] = [];
    for (const provider of providers) {
      try {
        const result = provider === 'voipms'
          ? await this.sendViaVoipMs(recipient, smsMessage)
          : provider === '3cx'
            ? await this.sendViaThreeCx(recipient, smsMessage)
            : await this.sendViaRelay(recipient, smsMessage);
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

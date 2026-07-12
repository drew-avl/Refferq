import crypto from 'node:crypto';

type JsonObject = Record<string, unknown>;

export class TwentyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly retryAfterMs?: number,
    readonly response?: string,
  ) {
    super(message);
    this.name = 'TwentyApiError';
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function recordsFromResponse(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => !!item && typeof item === 'object');
  const root = asObject(value);
  for (const candidate of [root.data, root.records, root.edges]) {
    if (Array.isArray(candidate)) {
      return candidate.map((item) => asObject(asObject(item).node || item));
    }
  }
  const data = asObject(root.data);
  for (const candidate of Object.values(data)) {
    if (Array.isArray(candidate)) return recordsFromResponse(candidate);
    const nested = asObject(candidate);
    if (Array.isArray(nested.edges)) return recordsFromResponse(nested.edges);
  }
  return [];
}

function recordFromResponse(value: unknown): JsonObject {
  const root = asObject(value);
  const data = asObject(root.data);
  if (Object.keys(data).length > 0 && data.id) return data;
  if (root.id) return root;
  for (const candidate of Object.values(data)) {
    const object = asObject(candidate);
    if (object.id) return object;
  }
  return root;
}

function safeText(value: unknown) {
  return JSON.stringify(value, (key, child) => /token|secret|authorization|api.?key/i.test(key) ? '[REDACTED]' : child).slice(0, 2000);
}

export class TwentyApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl?: string; apiKey?: string; timeoutMs?: number } = {}) {
    const baseUrl = options.baseUrl || process.env.TWENTY_API_BASE_URL;
    const apiKey = options.apiKey || process.env.TWENTY_API_KEY;
    if (!baseUrl || !apiKey) throw new Error('Twenty API mode requires TWENTY_API_BASE_URL and TWENTY_API_KEY.');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = options.timeoutMs || Number(process.env.TWENTY_API_TIMEOUT_MS || 12000);
  }

  async request(pathname: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const localRequestId = crypto.randomUUID();
    try {
      const response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          'X-ReferConnect-Request-Id': localRequestId,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 2000) }; }
      const requestId = response.headers.get('x-request-id') || response.headers.get('x-twenty-request-id') || localRequestId;
      if (!response.ok) {
        const retrySeconds = Number(response.headers.get('retry-after'));
        throw new TwentyApiError(
          `Twenty API returned HTTP ${response.status}: ${safeText(body)}`,
          response.status,
          requestId,
          Number.isFinite(retrySeconds) ? retrySeconds * 1000 : undefined,
          text.slice(0, 2000),
        );
      }
      return { body, status: response.status, requestId, responseText: text.slice(0, 2000) };
    } catch (error) {
      if (error instanceof TwentyApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TwentyApiError(`Twenty API timed out after ${this.timeoutMs}ms.`, 408, localRequestId);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async findByUnique(objectPlural: string, field: string, value: string) {
    const filter = `${field}[eq]:${JSON.stringify(value)}`;
    const response = await this.request(`/rest/${encodeURIComponent(objectPlural)}?filter=${encodeURIComponent(filter)}&limit=2`);
    const records = recordsFromResponse(response.body);
    if (records.length > 1) throw new Error(`Ambiguous Twenty match: ${objectPlural}.${field}=${value} returned ${records.length} records.`);
    return records[0] || null;
  }

  async create(objectPlural: string, data: JsonObject) {
    const response = await this.request(`/rest/${encodeURIComponent(objectPlural)}`, {
      method: 'POST', body: JSON.stringify(data),
    });
    return { record: recordFromResponse(response.body), ...response };
  }

  async update(objectPlural: string, id: string, data: JsonObject) {
    const response = await this.request(`/rest/${encodeURIComponent(objectPlural)}/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
    return { record: recordFromResponse(response.body), ...response };
  }

  async upsert(objectPlural: string, uniqueField: string, uniqueValue: string, data: JsonObject) {
    const existing = await this.findByUnique(objectPlural, uniqueField, uniqueValue);
    const result = existing?.id
      ? await this.update(objectPlural, String(existing.id), { ...data, [uniqueField]: uniqueValue })
      : await this.create(objectPlural, { ...data, [uniqueField]: uniqueValue });
    const id = String(result.record.id || existing?.id || '');
    if (!id) throw new Error(`Twenty ${objectPlural} upsert did not return a record ID.`);
    return { id, created: !existing, status: result.status, requestId: result.requestId, responseText: result.responseText };
  }
}


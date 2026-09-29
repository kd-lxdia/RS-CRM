import crypto from 'crypto';
import { prisma } from '../lib/clients';

// Lead-source integrations (IndiaMART, TradeIndia, Facebook, Aajjo, generic
// webhook/API, SMTP email). Each source gets a secret webhook URL:
//   POST /api/integrations/incoming/:source/:token
// Incoming payloads are normalized into RawLead rows (the existing calling
// pipeline picks them up from there).

export const LEAD_SOURCES = ['indiamart', 'tradeindia', 'facebook', 'aajjo', 'webhook'] as const;
export type LeadSourceKey = (typeof LEAD_SOURCES)[number];

const SETTING_KEY = 'lead_integrations';

export interface SourceConfig {
  enabled: boolean;
  token: string;
  leadsReceived: number;
  lastLeadAt: string | null;
}

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

export interface IntegrationsConfig {
  sources: Record<LeadSourceKey, SourceConfig>;
  email: EmailConfig;
}

function newToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function defaultConfig(): IntegrationsConfig {
  const sources = {} as Record<LeadSourceKey, SourceConfig>;
  for (const s of LEAD_SOURCES) {
    sources[s] = { enabled: false, token: newToken(), leadsReceived: 0, lastLeadAt: null };
  }
  return {
    sources,
    email: { enabled: false, host: '', port: 587, secure: false, user: '', pass: '', fromName: 'Slar CRM' },
  };
}

export async function getIntegrationsConfig(): Promise<IntegrationsConfig> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) {
    const cfg = defaultConfig();
    await prisma.systemSetting.create({ data: { key: SETTING_KEY, value: JSON.stringify(cfg) } });
    return cfg;
  }
  const def = defaultConfig();
  try {
    const saved = JSON.parse(row.value) as Partial<IntegrationsConfig>;
    return {
      sources: { ...def.sources, ...(saved.sources || {}) },
      email: { ...def.email, ...(saved.email || {}) },
    };
  } catch {
    return def;
  }
}

export async function saveIntegrationsConfig(cfg: IntegrationsConfig, updatedBy?: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(cfg), updatedBy },
    create: { key: SETTING_KEY, value: JSON.stringify(cfg), updatedBy },
  });
}

export function regenerateToken(cfg: IntegrationsConfig, source: LeadSourceKey): IntegrationsConfig {
  cfg.sources[source].token = newToken();
  return cfg;
}

// ─── Payload normalizers ─────────────────────────────────────────────────────

export interface NormalizedLead {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  pincode?: string;
  message?: string;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** IndiaMART Push API — payload sits under RESPONSE (or flat on some plans). */
function normalizeIndiamart(body: any): NormalizedLead | null {
  const r = body?.RESPONSE ?? body ?? {};
  const name = str(r.SENDER_NAME) || str(r.sender_name);
  const phone = str(r.SENDER_MOBILE) || str(r.MOB) || str(r.sender_mobile);
  if (!name || !phone) return null;
  return {
    name,
    phone,
    email: str(r.SENDER_EMAIL) || str(r.sender_email),
    city: str(r.SENDER_CITY) || str(r.sender_city),
    address: str(r.SENDER_ADDRESS) || str(r.sender_address),
    pincode: str(r.SENDER_PINCODE) || str(r.sender_pincode),
    message: str(r.QUERY_MESSAGE) || str(r.SUBJECT) || str(r.query_message),
  };
}

/** TradeIndia inquiry API fields. */
function normalizeTradeindia(body: any): NormalizedLead | null {
  const name = str(body?.sender_name) || str(body?.name);
  const phone = str(body?.sender_mobile) || str(body?.mobile) || str(body?.phone);
  if (!name || !phone) return null;
  return {
    name,
    phone,
    email: str(body?.sender_email) || str(body?.email),
    city: str(body?.sender_city) || str(body?.city),
    address: str(body?.sender_address),
    message: str(body?.subject) || str(body?.message),
  };
}

/** Facebook Lead Ads — supports the field_data array or a flat object. */
function normalizeFacebook(body: any): NormalizedLead | null {
  if (Array.isArray(body?.field_data)) {
    const fields: Record<string, string> = {};
    for (const f of body.field_data) {
      const v = Array.isArray(f?.values) ? f.values[0] : f?.values;
      if (f?.name && v) fields[String(f.name).toLowerCase()] = String(v);
    }
    const name = fields['full_name'] || fields['name'];
    const phone = fields['phone_number'] || fields['phone'];
    if (!name || !phone) return null;
    return {
      name,
      phone,
      email: fields['email'],
      city: fields['city'],
      message: fields['message'] || fields['job_title'],
    };
  }
  const name = str(body?.full_name) || str(body?.name);
  const phone = str(body?.phone_number) || str(body?.phone);
  if (!name || !phone) return null;
  return { name, phone, email: str(body?.email), city: str(body?.city), message: str(body?.message) };
}

/** Aajjo + generic webhook/API share a simple flat shape. */
function normalizeGeneric(body: any): NormalizedLead | null {
  const name = str(body?.name) || str(body?.customer_name) || str(body?.buyerName);
  const phone = str(body?.phone) || str(body?.mobile) || str(body?.contact) || str(body?.buyerMobile);
  if (!name || !phone) return null;
  return {
    name,
    phone,
    email: str(body?.email),
    city: str(body?.city),
    address: str(body?.address),
    pincode: str(body?.pincode) || str(body?.pin),
    message: str(body?.message) || str(body?.requirement) || str(body?.product),
  };
}

const NORMALIZERS: Record<LeadSourceKey, (body: any) => NormalizedLead | null> = {
  indiamart: normalizeIndiamart,
  tradeindia: normalizeTradeindia,
  facebook: normalizeFacebook,
  aajjo: normalizeGeneric,
  webhook: normalizeGeneric,
};

// ─── Ingestion ───────────────────────────────────────────────────────────────

export interface IngestResult {
  status: 'created' | 'duplicate' | 'invalid';
  rawLeadId?: string;
}

/** Normalize + dedupe (by phone) + store as RawLead. */
export async function ingestLead(source: LeadSourceKey, body: any): Promise<IngestResult> {
  const normalized = NORMALIZERS[source](body);
  if (!normalized) return { status: 'invalid' };

  // Dedupe: same phone already in the raw-lead pool → don't create twice.
  const phone = normalized.phone.replace(/[^\d+]/g, '');
  const existing = await prisma.rawLead.findFirst({ where: { phone } });
  if (existing) return { status: 'duplicate', rawLeadId: existing.id };

  const rawLead = await prisma.rawLead.create({
    data: {
      name: normalized.name,
      phone,
      email: normalized.email,
      city: normalized.city,
      address: [normalized.address, normalized.message ? `Note: ${normalized.message}` : null]
        .filter(Boolean)
        .join(' | ') || null,
      pincode: normalized.pincode,
      source: source.toUpperCase(),
      status: 'NEW',
      priority: 'WARM',
    },
  });

  // Update per-source stats (best effort).
  try {
    const cfg = await getIntegrationsConfig();
    cfg.sources[source].leadsReceived += 1;
    cfg.sources[source].lastLeadAt = new Date().toISOString();
    await saveIntegrationsConfig(cfg);
  } catch {
    /* stats are non-critical */
  }

  return { status: 'created', rawLeadId: rawLead.id };
}

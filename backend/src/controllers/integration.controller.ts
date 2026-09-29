import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import {
  LEAD_SOURCES,
  LeadSourceKey,
  getIntegrationsConfig,
  saveIntegrationsConfig,
  regenerateToken,
  ingestLead,
} from '../services/lead-integration.service';

function isSource(s: string): s is LeadSourceKey {
  return (LEAD_SOURCES as readonly string[]).includes(s);
}

/** Config safe for the UI: SMTP password masked, webhook URLs included. */
function toClient(cfg: Awaited<ReturnType<typeof getIntegrationsConfig>>, baseUrl: string) {
  const sources: any = {};
  for (const [k, v] of Object.entries(cfg.sources)) {
    sources[k] = {
      enabled: v.enabled,
      leadsReceived: v.leadsReceived,
      lastLeadAt: v.lastLeadAt,
      webhookUrl: `${baseUrl}/api/integrations/incoming/${k}/${v.token}`,
    };
  }
  return {
    sources,
    email: { ...cfg.email, pass: cfg.email.pass ? '••••••••' : '' },
  };
}

function baseUrlOf(req: Request): string {
  return process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
}

// GET /api/integrations/config (admin)
export const getConfig = async (req: AuthenticatedRequest, res: Response) => {
  const cfg = await getIntegrationsConfig();
  res.json({ success: true, data: toClient(cfg, baseUrlOf(req)) });
};

// PUT /api/integrations/config (admin) — toggle sources, set SMTP.
export const putConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cfg = await getIntegrationsConfig();
    const { sources, email } = req.body || {};
    if (sources) {
      for (const [k, v] of Object.entries(sources) as [string, any][]) {
        if (isSource(k) && typeof v?.enabled === 'boolean') cfg.sources[k].enabled = v.enabled;
      }
    }
    if (email) {
      const masked = email.pass === '••••••••' || email.pass === '';
      cfg.email = {
        ...cfg.email,
        ...email,
        pass: masked ? cfg.email.pass : email.pass,
      };
    }
    await saveIntegrationsConfig(cfg, req.user?.id);
    res.json({ success: true, data: toClient(cfg, baseUrlOf(req)) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err?.message || 'Invalid config' } });
  }
};

// POST /api/integrations/config/:source/regenerate-token (admin)
export const regenToken = async (req: AuthenticatedRequest, res: Response) => {
  const { source } = req.params;
  if (!isSource(source)) {
    return res.status(404).json({ success: false, error: { message: 'Unknown source' } });
  }
  const cfg = regenerateToken(await getIntegrationsConfig(), source);
  await saveIntegrationsConfig(cfg, req.user?.id);
  res.json({ success: true, data: toClient(cfg, baseUrlOf(req)) });
};

// POST /api/integrations/incoming/:source/:token — PUBLIC webhook receiver.
export const incomingLead = async (req: Request, res: Response) => {
  const { source, token } = req.params;
  if (!isSource(source)) {
    return res.status(404).json({ success: false, error: { message: 'Unknown source' } });
  }
  const cfg = await getIntegrationsConfig();
  const sc = cfg.sources[source];
  if (!sc.enabled || sc.token !== token) {
    return res.status(401).json({ success: false, error: { message: 'Invalid or disabled webhook' } });
  }
  const result = await ingestLead(source, req.body);
  if (result.status === 'invalid') {
    return res.status(422).json({ success: false, error: { message: 'Payload missing name/phone' } });
  }
  res.json({ success: true, data: result });
};

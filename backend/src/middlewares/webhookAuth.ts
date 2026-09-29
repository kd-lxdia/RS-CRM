import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Verify Meta WhatsApp webhook signature
 */
export const verifyWhatsAppWebhook = (req: Request, res: Response, next: NextFunction) => {
  // GET requests are for webhook verification during setup
  if (req.method === 'GET') {
    return next();
  }

  // For POST requests, verify the signature
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature missing' }
    });
  }

  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('META_WHATSAPP_APP_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Webhook verification not configured' }
    });
  }

  // Calculate expected signature
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Compare signatures
  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' }
    });
  }

  next();
};

/**
 * Verify SendGrid webhook signature
 */
export const verifySendGridWebhook = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature missing' }
    });
  }

  const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!verificationKey) {
    console.error('SENDGRID_WEBHOOK_VERIFICATION_KEY not configured');
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'Webhook verification not configured' }
    });
  }

  // Construct the payload
  const payload = timestamp + JSON.stringify(req.body);

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', verificationKey)
    .update(payload)
    .digest('base64');

  // Compare signatures
  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' }
    });
  }

  next();
};

/**
 * Simple API key authentication for internal webhooks
 */
export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('INTERNAL_API_KEY not configured');
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'API authentication not configured' }
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }
    });
  }

  next();
};

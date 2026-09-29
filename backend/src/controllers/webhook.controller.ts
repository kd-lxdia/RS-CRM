import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/clients';

// POST /api/webhooks/whatsapp
export const whatsappWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Meta requires a hub challenge verification GET for webhook setup
    if (req.method === 'GET') {
      const challenge = req.query['hub.challenge'];
      const verify_token = req.query['hub.verify_token'];
      if (verify_token === process.env.META_WHATSAPP_TOKEN) {
        return res.send(challenge);
      }
      return res.sendStatus(403);
    }

    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        // Handle delivery receipts
        if (value?.statuses) {
          for (const status of value.statuses) {
            const { status: deliveryStatus } = status;
            // Update campaign counts based on delivery status
            // In a real scenario you'd look up the message id from a receipts table
            if (deliveryStatus === 'delivered') {
              // prisma.campaign.update... (requires message-to-campaign mapping)
            } else if (deliveryStatus === 'read') {
              // track opens
            } else if (deliveryStatus === 'failed') {
              // track failures
            }
          }
        }
        // Handle inbound messages / replies
        if (value?.messages) {
          for (const message of value.messages) {
            // Store as a CallLog or create a new RawLead
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
};

// POST /api/webhooks/sendgrid
export const sendgridWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events: any[] = req.body || [];
    for (const event of events) {
      const { event: eventType, sg_message_id, email } = event;
      if (eventType === 'open') {
        // Update the campaign's 'opened' count
        // In a full impl, map sg_message_id → campaignId
      } else if (eventType === 'click') {
        // Track link clicks
      } else if (eventType === 'bounce' || eventType === 'dropped') {
        // Increment failed count
      }
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
};

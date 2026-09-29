import { Router } from 'express';
import { whatsappWebhook, sendgridWebhook } from '../controllers/webhook.controller';
import { verifyWhatsAppWebhook, verifySendGridWebhook } from '../middlewares/webhookAuth';

const router = Router();

// Webhook routes with signature verification
router.all('/whatsapp', verifyWhatsAppWebhook, whatsappWebhook);
router.post('/sendgrid', verifySendGridWebhook, sendgridWebhook);

export default router;

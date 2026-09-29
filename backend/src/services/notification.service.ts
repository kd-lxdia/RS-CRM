import axios from 'axios';
import sgMail from '@sendgrid/mail';
import { NotificationType } from '@slar-crm/shared';
import { prisma } from '../lib/clients';
import { getIO } from '../lib/socket';

if (process.env.SENDGRID_API_KEY?.startsWith('SG.')) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface WhatsAppData {
  phone: string;
  templateName: string;
  variables: string[];
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  channels: Array<'IN_APP' | 'WHATSAPP' | 'EMAIL'>;
  whatsappData?: WhatsAppData;
  emailData?: EmailData;
}

export async function sendNotification(input: NotificationInput): Promise<void> {
  const { userId, type, title, message, entityType, entityId, channels, whatsappData, emailData } = input;

  // 1. Always persist to DB
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      isRead: false,
    },
  });

  // 2. Always emit real-time Socket.io event to user's personal room
  try {
    const io = getIO();
    io.to(`user_${userId}`).emit('notification', {
      id: notification.id,
      type,
      title,
      message,
      entityType,
      entityId,
      createdAt: notification.createdAt,
      isRead: false,
    });
  } catch {
    // Socket not initialized (e.g. during tests) — non-fatal
  }

  // 3. WhatsApp via Meta Cloud API
  if (channels.includes('WHATSAPP') && whatsappData) {
    const { phone, templateName, variables } = whatsappData;
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (token && phoneNumberId) {
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en_US' },
              components: variables.length
                ? [
                    {
                      type: 'body',
                      parameters: variables.map((v) => ({ type: 'text', text: v })),
                    },
                  ]
                : [],
            },
          },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        console.error('[Notification] WhatsApp dispatch failed:', err?.response?.data ?? err.message);
      }
    }
  }

  // 4. Email via SendGrid
  if (channels.includes('EMAIL') && emailData) {
    const { to, subject, html } = emailData;
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({
          to,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@lohiasolar.com',
          subject,
          html,
        });
      } catch (err: any) {
        console.error('[Notification] Email dispatch failed:', err?.response?.body ?? err.message);
      }
    }
  }
}

/**
 * Helper: send notification to ALL users of a given role
 */
export async function sendNotificationToRole(
  role: string,
  input: Omit<NotificationInput, 'userId'>
): Promise<void> {
  const users = await prisma.user.findMany({ where: { role: role as any, isActive: true }, select: { id: true } });
  await Promise.allSettled(users.map((u) => sendNotification({ ...input, userId: u.id })));
}

import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redis, prisma } from '../lib/clients';

export const whatsappWorker = redis
  ? new Worker(
      'whatsapp-campaigns',
      async (job: Job) => {
        const { campaignId } = job.data;
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { template: true, rawLeads: { select: { phone: true } } },
        });
        if (!campaign) return;

        const token = process.env.META_WHATSAPP_TOKEN;
        const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
        const baseUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

        let sent = 0;
        let failed = 0;

        for (const lead of campaign.rawLeads) {
          try {
            await axios.post(
              baseUrl,
              {
                messaging_product: 'whatsapp',
                to: lead.phone,
                type: 'template',
                template: {
                  name: campaign.template.name.toLowerCase().replace(/\s+/g, '_'),
                  language: { code: 'en_US' },
                },
              },
              {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              }
            );
            sent++;
          } catch (err: any) {
            if (err?.response?.status === 429) {
              const delay = Math.min((job.data.retryCount || 0) * 2000 + 2000, 30000);
              const { whatsappQueue } = await import('../lib/clients');
              await whatsappQueue.add('send-whatsapp', { ...job.data, retryCount: (job.data.retryCount || 0) + 1 }, { delay });
              break;
            }
            failed++;
          }
        }

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { sent: { increment: sent }, failed: { increment: failed } },
        });
      },
      { connection: redis }
    )
  : null;

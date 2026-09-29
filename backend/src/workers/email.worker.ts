import { Worker, Job } from 'bullmq';
import sgMail from '@sendgrid/mail';
import { redis, prisma } from '../lib/clients';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const emailWorker = redis
  ? new Worker(
      'email-campaigns',
      async (job: Job) => {
        const { campaignId } = job.data;
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { template: true, rawLeads: { where: { email: { not: null } }, select: { email: true, name: true } } },
        });
        if (!campaign) return;

        const messages = campaign.rawLeads
          .filter((l: { email: string | null; name: string }) => l.email)
          .map((lead: { email: string | null; name: string }) => ({
            to: lead.email as string,
            from: 'noreply@slarcrm.com',
            subject: campaign.template.subject || campaign.name,
            html: (campaign.template.body || '').replace('{{name}}', lead.name || 'Customer'),
            trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
          }));

        if (messages.length === 0) return;

        try {
          await sgMail.send(messages as any[]);
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { sent: { increment: messages.length } },
          });
        } catch (err) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { failed: { increment: messages.length } },
          });
          throw err;
        }
      },
      { connection: redis }
    )
  : null;

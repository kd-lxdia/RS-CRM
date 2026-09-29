import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import aiVoiceService from '../services/ai-voice.service';
import xlsx from 'xlsx';

const prisma = new PrismaClient();

export class AIVoiceCampaignController {
  /**
   * Create a new AI voice campaign
   */
  async createCampaign(req: Request, res: Response) {
    try {
      const { name, description, scriptTemplate } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const campaign = await aiVoiceService.createCampaign({
        name,
        description,
        scriptTemplate,
        createdBy: userId,
        dealerId: req.user?.dealerId,
      });

      res.json(campaign);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const dealerId = req.user?.dealerId;

      const campaigns = await prisma.aIVoiceCampaign.findMany({
        where: {
          ...(dealerId ? { dealerId } : {}),
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              calls: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(campaigns);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const campaign = await prisma.aIVoiceCampaign.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          calls: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(campaign);
    } catch (error: any) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Upload Excel file with contacts
   */
  async uploadContacts(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Parse Excel file
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      // Validate and transform data
      const contacts = data.map((row: any) => ({
        name: row.Name || row.name || '',
        phone: String(row.Phone || row.phone || row.Mobile || row.mobile || '').replace(/\D/g, ''),
        email: row.Email || row.email || undefined,
        city: row.City || row.city || undefined,
        address: row.Address || row.address || undefined,
      })).filter(contact => contact.name && contact.phone && contact.phone.length === 10);

      if (contacts.length === 0) {
        return res.status(400).json({ error: 'No valid contacts found in Excel file' });
      }

      // Upload contacts to campaign
      await aiVoiceService.uploadContacts(id, contacts);

      res.json({
        message: `Successfully uploaded ${contacts.length} contacts`,
        count: contacts.length,
      });
    } catch (error: any) {
      console.error('Error uploading contacts:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Start a campaign
   */
  async startCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const campaign = await aiVoiceService.startCampaign(id);

      res.json({
        message: 'Campaign started successfully',
        campaign,
      });
    } catch (error: any) {
      console.error('Error starting campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const campaign = await aiVoiceService.pauseCampaign(id);

      res.json({
        message: 'Campaign paused successfully',
        campaign,
      });
    } catch (error: any) {
      console.error('Error pausing campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Resume a campaign
   */
  async resumeCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const campaign = await aiVoiceService.resumeCampaign(id);

      res.json({
        message: 'Campaign resumed successfully',
        campaign,
      });
    } catch (error: any) {
      console.error('Error resuming campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const stats = await aiVoiceService.getCampaignStats(id);

      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching campaign stats:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get calls for a campaign
   */
  async getCalls(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, disposition } = req.query;

      const calls = await prisma.aIVoiceCall.findMany({
        where: {
          campaignId: id,
          ...(status ? { status: status as any } : {}),
          ...(disposition ? { disposition: disposition as any } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(calls);
    } catch (error: any) {
      console.error('Error fetching calls:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get call details
   */
  async getCall(req: Request, res: Response) {
    try {
      const { callId } = req.params;

      const call = await prisma.aIVoiceCall.findUnique({
        where: { id: callId },
        include: {
          campaign: true,
          rawLead: true,
        },
      });

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      res.json(call);
    } catch (error: any) {
      console.error('Error fetching call:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Webhook handler for Bland AI callbacks
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const { callId } = req.params;
      const result = req.body;

      await aiVoiceService.handleWebhook(callId, result);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Manually convert call to raw lead
   */
  async convertToLead(req: Request, res: Response) {
    try {
      const { callId } = req.params;

      const rawLead = await aiVoiceService.convertToRawLead(callId);

      if (!rawLead) {
        return res.status(400).json({ error: 'Call already converted or not qualified' });
      }

      res.json({
        message: 'Call converted to raw lead successfully',
        rawLead,
      });
    } catch (error: any) {
      console.error('Error converting call:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.aIVoiceCampaign.delete({
        where: { id },
      });

      res.json({ message: 'Campaign deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default new AIVoiceCampaignController();

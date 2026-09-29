import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import AIVoiceAgentService from '../services/ai-voice-agent.service';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';

const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

/**
 * Upload Excel file and start AI calling campaign
 */
export const uploadAndStartCampaign = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = (req as any).file;
    const { campaignName, voiceProvider } = req.body;
    const userId = req.user!.id;
    const dealerId = req.user!.dealerId;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Parse Excel file
    const service = new AIVoiceAgentService(voiceProvider || 'bland');
    const leads = await service.parseExcelFile(file.path);

    if (leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid leads found in Excel file' });
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName || `AI Voice Campaign - ${new Date().toLocaleDateString()}`,
        type: 'AI_VOICE',
        status: 'ACTIVE',
        totalLeads: leads.length,
        createdBy: userId,
        dealerId: dealerId || undefined,
        metadata: {
          voiceProvider,
          fileName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Queue leads for calling
    await service.queueLeadsForCalling(leads, campaign.id, dealerId || '');

    res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        totalLeads: leads.length,
        message: `Campaign started! ${leads.length} leads queued for AI calling.`
      }
    });
  } catch (error: any) {
    console.error('Upload campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get AI calling campaign status
 */
export const getCampaignStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: {
            callLogs: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // Get call statistics
    const callStats = await prisma.callLog.groupBy({
      by: ['outcome'],
      where: { campaignId },
      _count: true
    });

    const stats = {
      total: campaign.totalLeads,
      called: campaign._count.callLogs,
      pending: campaign.totalLeads - campaign._count.callLogs,
      interested: callStats.find(s => s.outcome === 'INTERESTED')?._count || 0,
      notInterested: callStats.find(s => s.outcome === 'NOT_INTERESTED')?._count || 0,
      callback: callStats.find(s => s.outcome === 'CALLBACK')?._count || 0,
      noAnswer: callStats.find(s => s.outcome === 'NO_ANSWER')?._count || 0,
      wrongNumber: callStats.find(s => s.outcome === 'WRONG_NUMBER')?._count || 0
    };

    res.json({
      success: true,
      data: {
        campaign,
        stats
      }
    });
  } catch (error: any) {
    console.error('Get campaign status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get call logs for a campaign
 */
export const getCallLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { page = 1, limit = 20, outcome } = req.query;

    const where: any = { campaignId };
    if (outcome) {
      where.outcome = outcome;
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    const total = await prisma.callLog.count({ where });

    res.json({
      success: true,
      data: {
        callLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Get call logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Webhook endpoint for voice AI providers
 */
export const handleVoiceWebhook = async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    
    const service = new AIVoiceAgentService();
    await service.processCallWebhook(webhookData);

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get AI agent configuration
 */
export const getAgentConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = {
      availableProviders: [
        {
          id: 'bland',
          name: 'Bland AI',
          description: 'Easy to use, pre-built conversational AI',
          pricing: '$0.09/minute',
          features: ['Natural conversations', 'Indian voices', 'Real-time transcription']
        },
        {
          id: 'vapi',
          name: 'Vapi.ai',
          description: 'Highly customizable voice agents',
          pricing: '$0.05/minute',
          features: ['Custom workflows', 'Multiple voice options', 'Advanced analytics']
        },
        {
          id: 'retell',
          name: 'Retell AI',
          description: 'Low latency, natural conversations',
          pricing: '$0.08/minute',
          features: ['Ultra-low latency', 'Interruption handling', 'Emotion detection']
        }
      ],
      conversationSettings: {
        maxDuration: 5, // minutes
        language: 'en-IN',
        voice: 'maya',
        qualificationThreshold: 60
      },
      qualificationCriteria: {
        propertyOwnership: { weight: 25, required: true },
        monthlyBill: { weight: 30, minimum: 3000 },
        interestLevel: { weight: 25 },
        timeline: { weight: 20 }
      }
    };

    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('Get agent config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Test AI agent with a single call
 */
export const testAgentCall = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone, name, voiceProvider } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ success: false, error: 'Phone and name are required' });
    }

    const service = new AIVoiceAgentService(voiceProvider || 'bland');
    
    const result = await service.makeCallWithBland(
      { name, phone, source: 'TEST_CALL' },
      'test-campaign'
    );

    res.json({
      success: true,
      data: result,
      message: 'Test call initiated successfully'
    });
  } catch (error: any) {
    console.error('Test call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export { upload };

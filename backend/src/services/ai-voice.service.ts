import axios from 'axios';
import { PrismaClient, AICallStatus, AICallDisposition, RawLeadStatus, LeadSource } from '../lib/prisma-client-shim';

const prisma = new PrismaClient();

interface BlandAICallRequest {
  phone_number: string;
  task: string;
  voice?: string;
  language?: string;
  max_duration?: number;
  webhook?: string;
}

interface BlandAICallResponse {
  call_id: string;
  status: string;
}

interface CallResult {
  call_id: string;
  status: string;
  duration: number;
  transcript: string;
  recording_url?: string;
  analysis: {
    interested: boolean;
    property_owner: boolean;
    monthly_bill?: number;
    timeline?: string;
    notes?: string;
  };
}

export class AIVoiceService {
  private blandApiKey: string;
  private blandApiUrl = 'https://api.bland.ai/v1';

  constructor() {
    this.blandApiKey = process.env.BLAND_AI_API_KEY || '';
    if (!this.blandApiKey) {
      console.warn('BLAND_AI_API_KEY not set. AI voice calling will not work.');
    }
  }

  /**
   * Create a new AI voice campaign
   */
  async createCampaign(data: {
    name: string;
    description?: string;
    scriptTemplate: string;
    createdBy: string;
    dealerId?: string;
  }) {
    return prisma.aIVoiceCampaign.create({
      data: {
        ...data,
        status: 'DRAFT',
      },
    });
  }

  /**
   * Upload contacts from Excel data
   */
  async uploadContacts(campaignId: string, contacts: Array<{
    name: string;
    phone: string;
    email?: string;
    city?: string;
    address?: string;
  }>) {
    const calls = await prisma.aIVoiceCall.createMany({
      data: contacts.map(contact => ({
        campaignId,
        ...contact,
        status: 'PENDING' as AICallStatus,
      })),
    });

    // Update campaign total calls
    await prisma.aIVoiceCampaign.update({
      where: { id: campaignId },
      data: { totalCalls: { increment: contacts.length } },
    });

    return calls;
  }

  /**
   * Start a campaign - queue all pending calls
   */
  async startCampaign(campaignId: string) {
    const campaign = await prisma.aIVoiceCampaign.findUnique({
      where: { id: campaignId },
      include: { calls: { where: { status: 'PENDING' } } },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Update campaign status
    await prisma.aIVoiceCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Queue all pending calls asynchronously in background
    setTimeout(async () => {
      for (const call of campaign.calls) {
        try {
          await this.queueCall(call.id);
          // Add a 1 second delay between calls to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to process call ${call.id}:`, error);
        }
      }
    }, 0);

    return campaign;
  }

  /**
   * Queue a single call
   */
  async queueCall(callId: string) {
    const call = await prisma.aIVoiceCall.findUnique({
      where: { id: callId },
      include: { campaign: true },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    // Update status to queued
    await prisma.aIVoiceCall.update({
      where: { id: callId },
      data: {
        status: 'QUEUED',
        scheduledAt: new Date(),
      },
    });

    // Initiate the call with Bland AI
    await this.makeCall(callId);
  }

  /**
   * Make a call using Bland AI
   */
  private async makeCall(callId: string) {
    const call = await prisma.aIVoiceCall.findUnique({
      where: { id: callId },
      include: { campaign: true },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    try {
      // Update status to calling
      await prisma.aIVoiceCall.update({
        where: { id: callId },
        data: {
          status: 'CALLING',
          calledAt: new Date(),
        },
      });

      // Prepare the script with personalization
      const script = this.personalizeScript(call.campaign.scriptTemplate, {
        name: call.name,
        city: call.city || 'your area',
      });

      // Make the API call to Bland AI
      const response = await axios.post<BlandAICallResponse>(
        `${this.blandApiUrl}/calls`,
        {
          phone_number: call.phone,
          task: script,
          voice: 'maya', // Female Indian voice
          language: 'en-IN',
          max_duration: 300, // 5 minutes max
          webhook: `${process.env.BACKEND_URL}/api/ai-voice-campaigns/webhook/${callId}`,
        } as BlandAICallRequest,
        {
          headers: {
            'Authorization': this.blandApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`Call initiated for ${call.phone}:`, response.data);

      return response.data;
    } catch (error: any) {
      console.error(`Failed to make call ${callId}:`, error.message);

      // Update call status to failed
      await prisma.aIVoiceCall.update({
        where: { id: callId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          notes: error.message,
        },
      });

      // Update campaign stats
      await prisma.aIVoiceCampaign.update({
        where: { id: call.campaignId },
        data: {
          completedCalls: { increment: 1 },
          failedCalls: { increment: 1 },
        },
      });

      throw error;
    }
  }

  /**
   * Handle webhook callback from Bland AI
   */
  async handleWebhook(callId: string, result: CallResult) {
    const call = await prisma.aIVoiceCall.findUnique({
      where: { id: callId },
      include: { campaign: true },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    // Calculate qualification score
    const score = this.calculateQualificationScore(result.analysis);

    // Determine disposition
    const disposition = this.determineDisposition(result);

    // Update call record
    const updatedCall = await prisma.aIVoiceCall.update({
      where: { id: callId },
      data: {
        status: 'COMPLETED',
        disposition,
        callDuration: result.duration,
        transcript: result.transcript,
        recordingUrl: result.recording_url,
        qualificationScore: score,
        propertyOwnership: result.analysis.property_owner,
        monthlyBill: result.analysis.monthly_bill,
        interestLevel: result.analysis.interested ? 'HIGH' : 'LOW',
        timeline: result.analysis.timeline,
        notes: result.analysis.notes,
        completedAt: new Date(),
      },
    });

    // Update campaign stats
    const isSuccessful = disposition === 'INTERESTED';
    await prisma.aIVoiceCampaign.update({
      where: { id: call.campaignId },
      data: {
        completedCalls: { increment: 1 },
        successfulCalls: isSuccessful ? { increment: 1 } : undefined,
      },
    });

    // Auto-convert to raw lead if qualified
    if (score >= 60 && disposition === 'INTERESTED') {
      await this.convertToRawLead(callId);
    }

    return updatedCall;
  }

  /**
   * Convert qualified call to raw lead
   */
  async convertToRawLead(callId: string) {
    const call = await prisma.aIVoiceCall.findUnique({
      where: { id: callId },
      include: { campaign: true },
    });

    if (!call || call.convertedToRawLead) {
      return null;
    }

    // Create raw lead
    const rawLead = await prisma.rawLead.create({
      data: {
        name: call.name,
        phone: call.phone,
        email: call.email,
        address: call.address,
        city: call.city,
        source: 'EXCEL_UPLOAD' as LeadSource,
        status: 'INTERESTED' as RawLeadStatus,
        dealerId: call.campaign.dealerId,
      },
    });

    // Update call record
    await prisma.aIVoiceCall.update({
      where: { id: callId },
      data: {
        convertedToRawLead: true,
        rawLeadId: rawLead.id,
      },
    });

    // Create timeline event
    await prisma.timelineEvent.create({
      data: {
        rawLeadId: rawLead.id,
        eventType: 'AI_CALL_CONVERTED',
        description: `Qualified lead from AI voice campaign: ${call.campaign.name}`,
        metadata: {
          callId: call.id,
          campaignId: call.campaignId,
          qualificationScore: call.qualificationScore,
        },
      },
    });

    return rawLead;
  }

  /**
   * Personalize script with contact data
   */
  private personalizeScript(template: string, data: Record<string, string>): string {
    let script = template;
    Object.entries(data).forEach(([key, value]) => {
      script = script.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return script;
  }

  /**
   * Calculate qualification score based on conversation analysis
   */
  private calculateQualificationScore(analysis: CallResult['analysis']): number {
    let score = 0;

    // Property ownership (25 points)
    if (analysis.property_owner) {
      score += 25;
    }

    // Monthly bill (30 points)
    if (analysis.monthly_bill) {
      if (analysis.monthly_bill > 5000) score += 30;
      else if (analysis.monthly_bill >= 3000) score += 20;
      else score += 10;
    }

    // Interest level (25 points)
    if (analysis.interested) {
      score += 25;
    }

    // Timeline (20 points)
    if (analysis.timeline) {
      const timeline = analysis.timeline.toLowerCase();
      if (timeline.includes('immediate') || timeline.includes('1-3')) score += 20;
      else if (timeline.includes('3-6')) score += 15;
      else score += 5;
    }

    return score;
  }

  /**
   * Determine call disposition
   */
  private determineDisposition(result: CallResult): AICallDisposition {
    if (result.status === 'no-answer') return 'NO_ANSWER';
    if (result.status === 'voicemail') return 'VOICEMAIL';
    if (result.analysis.interested) return 'INTERESTED';
    return 'NOT_INTERESTED';
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string) {
    const campaign = await prisma.aIVoiceCampaign.findUnique({
      where: { id: campaignId },
      include: {
        calls: true,
        _count: {
          select: {
            calls: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stats = {
      total: campaign.totalCalls,
      completed: campaign.completedCalls,
      successful: campaign.successfulCalls,
      failed: campaign.failedCalls,
      pending: campaign.calls.filter(c => c.status === 'PENDING').length,
      queued: campaign.calls.filter(c => c.status === 'QUEUED').length,
      calling: campaign.calls.filter(c => c.status === 'CALLING').length,
      converted: campaign.calls.filter(c => c.convertedToRawLead).length,
      avgDuration: campaign.calls
        .filter(c => c.callDuration)
        .reduce((sum, c) => sum + (c.callDuration || 0), 0) / campaign.completedCalls || 0,
      avgScore: campaign.calls
        .filter(c => c.qualificationScore)
        .reduce((sum, c) => sum + (c.qualificationScore || 0), 0) / campaign.completedCalls || 0,
    };

    return stats;
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string) {
    return prisma.aIVoiceCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Resume a campaign
   */
  async resumeCampaign(campaignId: string) {
    const campaign = await prisma.aIVoiceCampaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
    });

    // Queue any pending calls in background
    const pendingCalls = await prisma.aIVoiceCall.findMany({
      where: {
        campaignId,
        status: 'PENDING',
      },
    });

    setTimeout(async () => {
      for (const call of pendingCalls) {
        try {
          await this.queueCall(call.id);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to process call ${call.id}:`, error);
        }
      }
    }, 0);

    return campaign;
  }
}

export default new AIVoiceService();

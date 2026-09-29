import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create call queue
const callQueue = new Queue('ai-voice-calls', { connection: redis });

interface LeadData {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  source: string;
}

interface CallResult {
  success: boolean;
  duration: number;
  transcript: string;
  qualificationScore: number;
  leadData: {
    ownsProperty: boolean;
    monthlyBill: number;
    interestLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    timeline: string;
    objections: string[];
  };
  outcome: 'INTERESTED' | 'NOT_INTERESTED' | 'CALLBACK' | 'WRONG_NUMBER' | 'NO_ANSWER';
  nextSteps: string;
}

/**
 * AI Voice Agent Service
 * Handles automated calling, conversation, and lead qualification
 */
export class AIVoiceAgentService {
  private voiceProvider: 'bland' | 'vapi' | 'retell' | 'twilio';
  private apiKey: string;

  constructor(provider: 'bland' | 'vapi' | 'retell' | 'twilio' = 'bland') {
    this.voiceProvider = provider;
    this.apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] || '';
  }

  /**
   * Parse Excel file and extract leads
   */
  async parseExcelFile(filePath: string): Promise<LeadData[]> {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.map((row: any) => ({
      name: row.Name || row.name || row.CUSTOMER_NAME || '',
      phone: this.normalizePhone(row.Phone || row.phone || row.MOBILE || row.CONTACT || ''),
      email: row.Email || row.email || row.EMAIL || '',
      city: row.City || row.city || row.CITY || '',
      address: row.Address || row.address || row.ADDRESS || '',
      source: 'AI_VOICE_CAMPAIGN'
    }));
  }

  /**
   * Normalize phone number to Indian format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 91, remove it
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    
    // Ensure 10 digits
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    
    return phone; // Return original if can't normalize
  }

  /**
   * Add leads to call queue
   */
  async queueLeadsForCalling(leads: LeadData[], campaignId: string, dealerId: string): Promise<void> {
    for (const lead of leads) {
      await callQueue.add('make-call', {
        lead,
        campaignId,
        dealerId,
        attempts: 0,
        maxAttempts: 3
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute
        }
      });
    }
  }

  /**
   * Make AI voice call using Bland AI
   */
  async makeCallWithBland(lead: LeadData, campaignId: string): Promise<CallResult> {
    try {
      const response = await axios.post(
        'https://api.bland.ai/v1/calls',
        {
          phone_number: lead.phone,
          task: this.getConversationScript(lead),
          voice: 'maya', // Female Indian voice
          language: 'en-IN',
          max_duration: 5, // 5 minutes max
          record: true,
          wait_for_greeting: true,
          interruption_threshold: 100,
          model: 'enhanced',
          webhook: `${process.env.BACKEND_URL}/api/ai-voice/webhook`,
          metadata: {
            leadName: lead.name,
            campaignId,
            source: 'excel_upload'
          }
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        duration: 0, // Will be updated by webhook
        transcript: '',
        qualificationScore: 0,
        leadData: {
          ownsProperty: false,
          monthlyBill: 0,
          interestLevel: 'LOW',
          timeline: '',
          objections: []
        },
        outcome: 'NO_ANSWER',
        nextSteps: 'Waiting for call completion'
      };
    } catch (error: any) {
      console.error('Bland AI call error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Make AI voice call using Vapi.ai
   */
  async makeCallWithVapi(lead: LeadData, campaignId: string): Promise<CallResult> {
    try {
      const response = await axios.post(
        'https://api.vapi.ai/call/phone',
        {
          phoneNumber: lead.phone,
          assistant: {
            model: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.7,
              systemPrompt: this.getConversationScript(lead)
            },
            voice: {
              provider: 'elevenlabs',
              voiceId: 'pNInz6obpgDQGcFmaJgB' // Indian female voice
            },
            firstMessage: `Hello! This is Maya from Slar Solar. Am I speaking with ${lead.name}?`
          },
          metadata: {
            leadName: lead.name,
            campaignId,
            source: 'excel_upload'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        duration: 0,
        transcript: '',
        qualificationScore: 0,
        leadData: {
          ownsProperty: false,
          monthlyBill: 0,
          interestLevel: 'LOW',
          timeline: '',
          objections: []
        },
        outcome: 'NO_ANSWER',
        nextSteps: 'Waiting for call completion'
      };
    } catch (error: any) {
      console.error('Vapi AI call error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get conversation script for AI agent
   */
  private getConversationScript(lead: LeadData): string {
    return `You are Maya, a friendly and professional sales representative from Slar Solar, India's leading solar panel installation company.

LEAD INFORMATION:
- Name: ${lead.name}
- Phone: ${lead.phone}
- City: ${lead.city || 'Unknown'}

YOUR OBJECTIVE:
Qualify the lead for solar panel installation by gathering key information and gauging interest.

CONVERSATION FLOW:

1. GREETING & VERIFICATION (15 seconds)
   - Greet warmly and verify you're speaking with ${lead.name}
   - Briefly introduce yourself and Slar Solar
   - Ask if they have 2-3 minutes to discuss solar energy savings

2. QUALIFICATION QUESTIONS (60-90 seconds)
   Ask these questions naturally in conversation:
   
   a) Property Ownership:
      "Do you own your home or property?"
      [CRITICAL: Only proceed if they own property]
   
   b) Electricity Bill:
      "What's your approximate monthly electricity bill?"
      [TARGET: ₹3,000+ per month]
   
   c) Interest Level:
      "Have you considered switching to solar energy before?"
      "What interests you most - saving money or being eco-friendly?"
   
   d) Timeline:
      "When would you ideally like to make this switch?"
      [OPTIONS: Immediate (1-3 months), Soon (3-6 months), Later (6+ months)]

3. VALUE PROPOSITION (30-45 seconds)
   Based on their bill amount, calculate and share:
   - Annual savings (approximately 80% of current bill)
   - Government subsidy available (up to 40% cost reduction)
   - Payback period (typically 3-4 years)
   - 25-year warranty and benefits

4. HANDLE OBJECTIONS
   Common objections and responses:
   
   - "Too expensive": Mention subsidies, financing options, and ROI
   - "Not sure it works": Share success stories, 25-year warranty
   - "Need to think": Offer free site survey with no obligation
   - "Renting property": Politely explain solar is for property owners

5. CLOSING (30 seconds)
   If interested (score 60+):
   - Offer FREE site survey
   - Confirm address
   - Set expectation: Expert will call within 24 hours
   - Send confirmation SMS
   
   If not interested:
   - Thank them for their time
   - Ask if they'd like information for future
   - End politely

IMPORTANT RULES:
- Be conversational and natural, not robotic
- Listen actively and respond to their concerns
- Don't be pushy - focus on education and value
- If they say "not interested" twice, politely end the call
- If wrong number or not available, apologize and end call
- Keep total call under 5 minutes
- Speak in a mix of English and simple Hindi if they prefer

LEAD SCORING (Internal - don't mention to lead):
- Property Owner: 25 points
- Bill >₹5,000: 30 points | ₹3,000-₹5,000: 20 points | <₹3,000: 10 points
- Very Interested: 25 points | Somewhat: 15 points | Not: 0 points
- Immediate timeline: 20 points | Soon: 15 points | Later: 5 points

QUALIFICATION THRESHOLD: 60+ points = Schedule site survey

At the end of the call, provide a JSON summary with:
{
  "ownsProperty": boolean,
  "monthlyBill": number,
  "interestLevel": "HIGH" | "MEDIUM" | "LOW",
  "timeline": string,
  "objections": [array of objections raised],
  "qualificationScore": number,
  "outcome": "INTERESTED" | "NOT_INTERESTED" | "CALLBACK" | "WRONG_NUMBER",
  "nextSteps": string,
  "notes": string
}`;
  }

  /**
   * Process call webhook from voice AI provider
   */
  async processCallWebhook(webhookData: any): Promise<void> {
    const { call_id, status, transcript, duration, metadata } = webhookData;

    // Parse AI analysis from transcript
    const analysis = this.analyzeConversation(transcript);
    
    // Calculate qualification score
    const score = this.calculateQualificationScore(analysis);

    // Create call log
    await prisma.callLog.create({
      data: {
        callId: call_id,
        leadName: metadata.leadName,
        phone: webhookData.to,
        duration,
        transcript,
        status,
        qualificationScore: score,
        outcome: analysis.outcome,
        metadata: analysis,
        campaignId: metadata.campaignId
      }
    });

    // If qualified, create lead in CRM
    if (score >= 60 && analysis.outcome === 'INTERESTED') {
      await this.createQualifiedLead(webhookData, analysis);
    }
  }

  /**
   * Analyze conversation transcript using AI
   */
  private analyzeConversation(transcript: string): any {
    // This would use OpenAI to analyze the transcript
    // For now, returning mock data
    return {
      ownsProperty: true,
      monthlyBill: 4500,
      interestLevel: 'HIGH',
      timeline: 'Immediate (1-3 months)',
      objections: ['Cost concerns'],
      outcome: 'INTERESTED',
      nextSteps: 'Schedule site survey',
      notes: 'Very interested, wants to save on electricity bills'
    };
  }

  /**
   * Calculate lead qualification score
   */
  private calculateQualificationScore(analysis: any): number {
    let score = 0;

    // Property ownership (25 points)
    if (analysis.ownsProperty) score += 25;

    // Monthly bill (30 points)
    if (analysis.monthlyBill > 5000) score += 30;
    else if (analysis.monthlyBill >= 3000) score += 20;
    else if (analysis.monthlyBill > 0) score += 10;

    // Interest level (25 points)
    if (analysis.interestLevel === 'HIGH') score += 25;
    else if (analysis.interestLevel === 'MEDIUM') score += 15;

    // Timeline (20 points)
    if (analysis.timeline.includes('Immediate')) score += 20;
    else if (analysis.timeline.includes('Soon')) score += 15;
    else if (analysis.timeline.includes('Later')) score += 5;

    return score;
  }

  /**
   * Create qualified lead in CRM
   */
  private async createQualifiedLead(webhookData: any, analysis: any): Promise<void> {
    const { metadata } = webhookData;

    // Create lead in database
    await prisma.lead.create({
      data: {
        leadCode: `AI-${Date.now()}`,
        name: metadata.leadName,
        phone: webhookData.to,
        source: 'AI_VOICE_AGENT',
        status: 'NEW',
        qualificationScore: this.calculateQualificationScore(analysis),
        notes: `AI Agent Call: ${analysis.notes}\nInterest Level: ${analysis.interestLevel}\nMonthly Bill: ₹${analysis.monthlyBill}\nTimeline: ${analysis.timeline}`,
        // Will be assigned by system based on zone
      }
    });
  }
}

/**
 * Initialize call queue worker
 */
export function initializeCallWorker() {
  const worker = new Worker('ai-voice-calls', async (job) => {
    const { lead, campaignId, dealerId, attempts } = job.data;
    
    const service = new AIVoiceAgentService();
    
    try {
      // Make the call
      const result = await service.makeCallWithBland(lead, campaignId);
      
      console.log(`Call initiated for ${lead.name} (${lead.phone})`);
      
      return result;
    } catch (error: any) {
      console.error(`Call failed for ${lead.name}:`, error.message);
      
      // Retry logic
      if (attempts < 3) {
        throw error; // Will trigger retry
      }
      
      // Max attempts reached, mark as failed
      await prisma.callLog.create({
        data: {
          leadName: lead.name,
          phone: lead.phone,
          status: 'FAILED',
          outcome: 'NO_ANSWER',
          notes: `Failed after ${attempts} attempts: ${error.message}`,
          campaignId
        }
      });
    }
  }, { connection: redis });

  worker.on('completed', (job) => {
    console.log(`Call job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Call job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export default AIVoiceAgentService;

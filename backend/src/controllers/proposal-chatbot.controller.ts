import { Request, Response, NextFunction } from 'express';
import { 
  handleChatbotMessage, 
  transcribeAudio 
} from '../services/proposal-chatbot.service';
import { prisma } from '../lib/clients';

// ─── Send Message ────────────────────────────────────────────────────────────

export async function sendChatbotMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { proposalId, token, message, language, conversationHistory } = req.body;

    // Validate token
    const proposal = await prisma.solarProposal.findFirst({
      where: {
        id: proposalId,
        publicToken: token,
        publicTokenExpiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired proposal link' },
      });
    }

    // Handle message
    const response = await handleChatbotMessage({
      proposalId,
      message,
      language: language || 'en',
      conversationHistory: conversationHistory || [],
    });

    // Log conversation for analytics
    await prisma.chatbotConversation.create({
      data: {
        proposalId,
        userMessage: message,
        botResponse: response.text,
        language,
        wasOutOfScope: response.suggestCallSalesperson,
      },
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Transcribe Audio ────────────────────────────────────────────────────────

export async function transcribeAudioMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token, language } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_AUDIO', message: 'No audio file provided' },
      });
    }

    // Validate token
    const proposal = await prisma.solarProposal.findFirst({
      where: {
        publicToken: token,
        publicTokenExpiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired proposal link' },
      });
    }

    // Transcribe audio
    const text = await transcribeAudio(audioFile.buffer, language || 'en');

    res.json({
      success: true,
      data: { text },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Generate Public Link ────────────────────────────────────────────────────

export async function generatePublicLink(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { expiryDays = 30 } = req.body;

    // Generate unique token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Update proposal
    const proposal = await prisma.solarProposal.update({
      where: { id },
      data: {
        publicToken: token,
        publicTokenExpiresAt: expiresAt,
      },
    });

    const publicUrl = `${process.env.FRONTEND_URL}/proposal/view/${token}`;

    res.json({
      success: true,
      data: {
        publicUrl,
        token,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get Public Proposal ─────────────────────────────────────────────────────

export async function getPublicProposal(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token } = req.params;

    const proposal = await prisma.solarProposal.findFirst({
      where: {
        publicToken: token,
        publicTokenExpiresAt: {
          gte: new Date(),
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        lead: {
          select: {
            name: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        creator: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Proposal not found or expired' },
      });
    }

    // Increment view count
    await prisma.solarProposal.update({
      where: { id: proposal.id },
      data: {
        viewCount: {
          increment: 1,
        },
        lastViewedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: proposal,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Get Chatbot Analytics ───────────────────────────────────────────────────

export async function getChatbotAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { proposalId } = req.params;

    const conversations = await prisma.chatbotConversation.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });

    const totalMessages = conversations.length;
    const outOfScopeCount = conversations.filter(c => c.wasOutOfScope).length;
    const languages = [...new Set(conversations.map(c => c.language))];

    res.json({
      success: true,
      data: {
        totalMessages,
        outOfScopeCount,
        outOfScopePercentage: totalMessages > 0 ? (outOfScopeCount / totalMessages) * 100 : 0,
        languages,
        conversations: conversations.slice(0, 50), // Last 50 conversations
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateToken(): string {
  // Security: Use cryptographically secure random token generation
  return crypto.randomBytes(32).toString('base64url');
}

import crypto from 'crypto';

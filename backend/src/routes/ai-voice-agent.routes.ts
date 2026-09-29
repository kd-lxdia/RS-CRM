import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  uploadAndStartCampaign,
  getCampaignStatus,
  getCallLogs,
  handleVoiceWebhook,
  getAgentConfig,
  testAgentCall,
  upload
} from '../controllers/ai-voice-agent.controller';

const router = Router();

// Upload Excel and start AI calling campaign
router.post(
  '/campaign/upload',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.PROJECT_HEAD),
  upload.single('file'),
  uploadAndStartCampaign
);

// Get campaign status
router.get(
  '/campaign/:campaignId/status',
  authenticate,
  getCampaignStatus
);

// Get call logs for a campaign
router.get(
  '/campaign/:campaignId/calls',
  authenticate,
  getCallLogs
);

// Webhook endpoint for voice AI providers (no auth - external)
router.post('/webhook', handleVoiceWebhook);

// Get AI agent configuration
router.get(
  '/config',
  authenticate,
  getAgentConfig
);

// Test AI agent with a single call
router.post(
  '/test-call',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.CALLING_STAFF),
  testAgentCall
);

export default router;

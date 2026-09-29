import { Router } from 'express';
import multer from 'multer';
import aiVoiceCampaignController from '../controllers/ai-voice-campaign.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Webhook (no auth required)
router.post('/webhook/:callId', aiVoiceCampaignController.handleWebhook);

// All routes require authentication
router.use(authenticate);

// Campaign management
router.post('/', aiVoiceCampaignController.createCampaign);
router.get('/', aiVoiceCampaignController.getCampaigns);
router.get('/:id', aiVoiceCampaignController.getCampaign);
router.delete('/:id', aiVoiceCampaignController.deleteCampaign);

// Campaign operations
router.post('/:id/upload', upload.single('file'), aiVoiceCampaignController.uploadContacts);
router.post('/:id/start', aiVoiceCampaignController.startCampaign);
router.post('/:id/pause', aiVoiceCampaignController.pauseCampaign);
router.post('/:id/resume', aiVoiceCampaignController.resumeCampaign);
router.get('/:id/stats', aiVoiceCampaignController.getCampaignStats);

// Call management
router.get('/:id/calls', aiVoiceCampaignController.getCalls);
router.get('/calls/:callId', aiVoiceCampaignController.getCall);
router.post('/calls/:callId/convert', aiVoiceCampaignController.convertToLead);



export default router;

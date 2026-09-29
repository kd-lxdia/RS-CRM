import { Router } from 'express';
import multer from 'multer';
import {
  sendChatbotMessage,
  transcribeAudioMessage,
  generatePublicLink,
  getPublicProposal,
  getChatbotAnalytics,
} from '../controllers/proposal-chatbot.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateChatbotMessage, validateUuidParam } from '../middlewares/validation';
import { chatbotLimiter } from '../middlewares/rateLimiter';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for audio
});

// Public routes (with rate limiting)
router.post('/chatbot/message', chatbotLimiter, validateChatbotMessage, sendChatbotMessage);
router.post('/chatbot/transcribe', chatbotLimiter, upload.single('audio'), transcribeAudioMessage);
router.get('/public/:token', getPublicProposal);

// Protected routes
router.post('/:id/generate-link', authenticate, validateUuidParam('id'), generatePublicLink);
router.get('/:id/chatbot-analytics', authenticate, validateUuidParam('id'), getChatbotAnalytics);

export default router;

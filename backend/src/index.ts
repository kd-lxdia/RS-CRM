import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import winston from 'winston';
import { UserRole } from '@slar-crm/shared';

import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import templateRoutes from './routes/template.routes';
import rawLeadRoutes from './routes/rawLead.routes';
import webhookRoutes from './routes/webhook.routes';
import zoneRoutes from './routes/zone.routes';
import leadRoutes from './routes/lead.routes';
import visitRoutes from './routes/visit.routes';
import solarEngineRoutes from './routes/solar-engine.routes';
import proposalRoutes from './routes/proposal.routes';
import proposalChatbotRoutes from './routes/proposal-chatbot.routes';
import solarConfigRoutes from './routes/solar-config.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import customerRoutes from './routes/customer.routes';
import documentationRoutes from './routes/documentation.routes';
import documentRoutes from './routes/document.routes';
import installationRoutes from './routes/installation.routes';
import siteSurveyRoutes from './routes/site-survey.routes';
import bomRoutes from './routes/bom.routes';
import warehouseRoutes from './routes/warehouse.routes';
import { accountsRouter, invoicesRouter, paymentsRouter } from './routes/finance.routes';
import projectHeadRoutes from './routes/project-head.routes';
import adminRoutes from './routes/admin.routes';
import dealerRoutes from './routes/dealer.routes';
import { initScheduledNotifications } from './services/notification-scheduler.service';
import { initSocket } from './lib/socket';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/logger';
import { apiLimiter } from './middlewares/rateLimiter';
import userRoutes from './routes/user.routes';
import taskRoutes from './routes/task.routes';
import notificationRoutes from './routes/notification.routes';
import teamHierarchyRoutes from './routes/team-hierarchy.routes';
import performanceRoutes from './routes/performance.routes';
import escalationRoutes from './routes/escalation.routes';
import aiVoiceCampaignRoutes from './routes/ai-voice-campaign.routes';
import googleMapsRoutes from './routes/google-maps.routes';
import travelLogRoutes from './routes/travel-log.routes';
import systemSettingRoutes from './routes/system-setting.routes';
import attendanceRoutes from './routes/attendance.routes';
import holidayRoutes from './routes/holiday.routes';
import payrollRoutes from './routes/payroll.routes';
import epcV2Routes from './routes/epc-v2.routes';
import b2bPiRoutes from './routes/b2b-pi.routes';
import aiBrainRoutes from './routes/ai-brain.routes';
import integrationRoutes from './routes/integration.routes';
import reportingRoutes from './routes/reporting.routes';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

export const app = express();
const httpServer = createServer(app);
export const io = initSocket(httpServer);

// Initialize Voice Socket for AI Voice Test Interface
import { initVoiceSocket } from './lib/voice-socket';
initVoiceSocket(io);

// Security: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Security: Strict CORS configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use('/api', apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', usingRole: UserRole.ADMIN });
});

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/raw-leads', rawLeadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/solar-engine', solarEngineRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/proposals', proposalChatbotRoutes);
app.use('/api/admin/solar-config', solarConfigRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/documentation', documentationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/installation', installationRoutes);
app.use('/api/site-surveys', siteSurveyRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/accounts', accountsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/project-head', projectHeadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dealer', dealerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/team', teamHierarchyRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/ai-voice-campaigns', aiVoiceCampaignRoutes);
app.use('/api/google-maps', googleMapsRoutes);
app.use('/api/travel-logs', travelLogRoutes);
app.use('/api/system-settings', systemSettingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/epc-v2', epcV2Routes);
app.use('/api/b2b-pi', b2bPiRoutes);
app.use('/api/ai-brain', aiBrainRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/reports', reportingRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    initScheduledNotifications();
  });
}

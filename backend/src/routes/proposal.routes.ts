import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  createProposal,
  getProposalsByLead,
  getProposal,
  reviseProposal,
  acceptProposal,
  sendProposal,
  compareProposals,
  getProposalAnalytics,
} from '../controllers/proposal.controller';

const router = Router();
router.use(authenticate);

// Analytics (Project Head + Admin only)
router.get('/analytics', authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD), getProposalAnalytics);

// Comparison (any authenticated — salesperson uses this)
router.post('/compare', compareProposals);

// Lead-scoped proposal list
router.get('/lead/:leadId', getProposalsByLead);

// Single proposal
router.get('/:id', getProposal);
router.post('/', createProposal);
router.post('/:id/revise', reviseProposal);
router.post('/:id/accept', acceptProposal);
router.post('/:id/send', sendProposal);

export default router;

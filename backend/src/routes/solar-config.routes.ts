import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  listConfigPanels, upsertConfigPanel, deleteConfigPanel,
  listConfigInverters, upsertConfigInverter,
  getPricing, updatePricing,
  getSubsidyConfig, updateSubsidyConfig,
  getTemplateConfig, updateTemplateConfig,
} from '../controllers/solar-config.controller';

const router = Router();
router.use(authenticate, authorize(UserRole.ADMIN));

// Panels
router.get('/panels', listConfigPanels);
router.post('/panels', upsertConfigPanel);
router.delete('/panels/:id', deleteConfigPanel);

// Inverters
router.get('/inverters', listConfigInverters);
router.post('/inverters', upsertConfigInverter);

// Pricing defaults
router.get('/pricing', getPricing);
router.patch('/pricing', updatePricing);

// Subsidy slabs
router.get('/subsidy', getSubsidyConfig);
router.patch('/subsidy', updateSubsidyConfig);

// Proposal template
router.get('/template', getTemplateConfig);
router.patch('/template', updateTemplateConfig);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '@slar-crm/shared';
import {
  sizeSystem,
  calculateFull,
  listPanels,
  listInverters,
  getSubsidySlabs,
  shadingReport,
  sunPosition,
} from '../services/solar-engine/solar-engine.controller';

const router = Router();

router.use(authenticate);

// Public (any authenticated user) — Sales/Calling staff needs to calculate on the fly
router.post('/size', sizeSystem);
router.post('/calculate', calculateFull);
router.get('/panels', listPanels);
router.get('/inverters', listInverters);
router.get('/subsidy-slabs', getSubsidySlabs);

// Shadow simulation (runs on server for PDF generation — results cached 24hr in Redis)
router.post('/shading-report', shadingReport);
router.get('/sun-position', sunPosition);  // quick sun position query for UI

// Admin-only slab updates (returns 501 placeholder until Redis config store is wired)
router.put('/subsidy-slabs', authorize(UserRole.ADMIN), (req, res) => {
  // In production: persist updated slabs to Redis + DB, then reload
  res.status(501).json({ success: false, error: { message: 'Admin slab override not yet bootstrapped — wire to Redis config store' } });
});

export default router;

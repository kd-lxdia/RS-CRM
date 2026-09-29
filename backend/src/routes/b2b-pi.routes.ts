import { Router } from 'express';
import { UserRole } from '@slar-crm/shared';
import { authenticate, authorize } from '../middlewares/auth';
import {
  approvePi,
  createPi,
  createPriceItem,
  getPi,
  listParties,
  listPis,
  listPriceItems,
  markPiSent,
  rejectPi,
  upsertParty,
} from '../controllers/b2b-pi.controller';

const router = Router();

router.use(authenticate);

const piViewRoles = [UserRole.ADMIN, UserRole.PROJECT_HEAD, UserRole.CALLING_STAFF, UserRole.SALESPERSON];
const piCreateRoles = [UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.SALESPERSON];

router.get('/parties', authorize(...piViewRoles), listParties);
router.post('/parties', authorize(...piCreateRoles), upsertParty);
router.put('/parties/:id', authorize(...piCreateRoles), upsertParty);

router.get('/price-items', authorize(...piViewRoles), listPriceItems);
router.post('/price-items', authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD), createPriceItem);

router.get('/pis', authorize(...piViewRoles), listPis);
router.post('/pis', authorize(...piCreateRoles), createPi);
router.get('/pis/:id', authorize(...piViewRoles), getPi);
router.post('/pis/:id/approve', authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD), approvePi);
router.post('/pis/:id/reject', authorize(UserRole.ADMIN, UserRole.PROJECT_HEAD), rejectPi);
router.post('/pis/:id/send', authorize(...piCreateRoles, UserRole.PROJECT_HEAD), markPiSent);

export default router;

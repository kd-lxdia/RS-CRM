import { Router } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import {
  listRawLeads, createRawLead, bulkCreateRawLeads, getRawLead, updateRawLead, addCallLog, convertToLead,
} from '../controllers/rawLead.controller';
import { parseExcel } from '../controllers/excel.controller';
import { authenticate, authorize, dealerScope } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UserRole } from '@slar-crm/shared';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate, dealerScope);

const CALLERS = [UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN, UserRole.DEALER_STAFF];

router.get('/', authorize(...CALLERS), listRawLeads);
router.post('/', authorize(...CALLERS), [
  body('name').notEmpty(), body('phone').notEmpty(), validate,
], createRawLead);
router.post('/bulk', authorize(UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN), [
  body('records').isArray({ min: 1, max: 5000 }), validate,
], bulkCreateRawLeads);
router.post('/parse-excel', authenticate, upload.single('file'), parseExcel);
router.get('/:id', authorize(...CALLERS), getRawLead);
router.patch('/:id', authorize(...CALLERS), updateRawLead);
router.post('/:id/call-log', authorize(...CALLERS), [
  body('callType').isIn(['OUTBOUND', 'INBOUND']),
  body('disposition').isIn(['FOLLOW_UP', 'NOT_INTERESTED', 'CALL_NOT_RECEIVED', 'WRONG_NUMBER', 'INTERESTED', 'OTHER']),
  validate,
], addCallLog);
router.post('/:id/convert', authorize(UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.DEALER_ADMIN), [
  body('assignedSalesperson').notEmpty(), body('zoneId').notEmpty(), validate,
], convertToLead);

export default router;

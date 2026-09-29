import { Router } from 'express';
import { createLead, bulkUploadLeads, exportLeads, listLeads, getLead, updateLead, addCallLog, convertToCustomer } from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { body } from 'express-validator';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.get('/', listLeads);
router.get('/export/csv', exportLeads);
router.get('/:id', getLead);

router.post('/', createLead);
router.post('/bulk-upload', upload.single('file'), bulkUploadLeads);
router.patch('/:id', updateLead);

router.post('/:id/call-log', [
  body('callType').isIn(['INBOUND', 'OUTBOUND']),
  body('disposition').notEmpty(),
  validate
], addCallLog);

router.post('/:id/convert-to-customer', convertToCustomer);

export default router;

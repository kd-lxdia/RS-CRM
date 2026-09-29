import { Router } from 'express';
import { upload, handleMulterError } from '../middlewares/fileUpload';
import { downloadAllDocuments, downloadDocument, uploadDocuments } from '../controllers/document.controller';
import { authenticate } from '../middlewares/auth';
import { validateDocumentUpload, validateUuidParam } from '../middlewares/validation';
import { uploadLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.get('/customer/:customerId/download-all', authenticate, validateUuidParam('customerId'), downloadAllDocuments);
router.get('/:id/download', authenticate, validateUuidParam('id'), downloadDocument);
router.post('/upload', authenticate, uploadLimiter, upload.array('files', 10), handleMulterError, validateDocumentUpload, uploadDocuments);

export default router;

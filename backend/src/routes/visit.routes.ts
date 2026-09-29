import { Router } from 'express';
import { checkInVisit, checkInStatus, listVisits, scheduleVisit, getVisit, rescheduleVisit, cancelVisit, getMyRoute, getCalendar, getVisitForm, updateVisitForm, completeVisit, uploadDocuments } from '../controllers/visit.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UserRole } from '@slar-crm/shared';
import multer from 'multer';
import { body } from 'express-validator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

// List, Schedules & Top-level Operations
router.get('/', listVisits);
router.post('/', authorize(UserRole.ADMIN, UserRole.CALLING_STAFF), scheduleVisit);
router.get('/my-route', authorize(UserRole.SALESPERSON), getMyRoute);
router.get('/calendar', getCalendar);

// Single Visit Operations
router.get('/:id', getVisit);
router.patch('/:id', authorize(UserRole.ADMIN, UserRole.CALLING_STAFF, UserRole.SALESPERSON), rescheduleVisit);
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.CALLING_STAFF), cancelVisit);

// Forms, Completions & Media
router.get('/:id/form', authorize(UserRole.SALESPERSON, UserRole.ADMIN), getVisitForm);
router.put('/:id/form', authorize(UserRole.SALESPERSON, UserRole.ADMIN), updateVisitForm);
router.post('/:id/complete', authorize(UserRole.SALESPERSON, UserRole.ADMIN), completeVisit);

router.post('/:id/documents', authorize(UserRole.SALESPERSON, UserRole.ADMIN), 
  upload.fields([
    { name: 'aadhaar_front', maxCount: 1 },
    { name: 'aadhaar_back', maxCount: 1 },
    { name: 'electricity_bill', maxCount: 1 },
    { name: 'site_photos', maxCount: 10 }
  ]), uploadDocuments);

// Original geo proximity flows
router.post('/:id/checkin', authorize(UserRole.SALESPERSON, UserRole.ADMIN), [
  body('lat').isNumeric(),
  body('lng').isNumeric(),
  validate
], checkInVisit);

router.get('/:id/checkin-status', checkInStatus);

export default router;

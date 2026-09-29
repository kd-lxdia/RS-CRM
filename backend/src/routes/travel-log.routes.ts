import { Router } from 'express';
import { 
  submitTravelLog, 
  getTravelLogs, 
  updateTravelLogStatus, 
  bulkUpdateStatus, 
  deleteTravelLog,
  updateSegmentStatus
} from '../controllers/travel-log.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate); // Ensure user is authenticated

router.route('/')
  .post(submitTravelLog)
  .get(getTravelLogs);

router.post('/bulk-approve', bulkUpdateStatus);

router.route('/:id')
  .patch(updateTravelLogStatus)
  .delete(deleteTravelLog);

router.patch('/:id/segment/:index', updateSegmentStatus);

export default router;

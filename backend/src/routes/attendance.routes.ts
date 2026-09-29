import { Router } from 'express';
import { markAttendance, getAttendanceMatrix } from '../controllers/attendance.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/mark', markAttendance);
router.get('/matrix', getAttendanceMatrix);

export default router;

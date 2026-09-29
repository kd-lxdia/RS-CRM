import { Router } from 'express';
import { calculatePayroll } from '../controllers/payroll.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', calculatePayroll);

export default router;

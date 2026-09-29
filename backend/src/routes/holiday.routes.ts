import { Router } from 'express';
import { getHolidays, createHoliday, deleteHoliday } from '../controllers/holiday.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getHolidays);
router.post('/', createHoliday);
router.delete('/:id', deleteHoliday);

export default router;

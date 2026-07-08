import express from 'express';
const router = express.Router();

import { getPendingEvents, approveEvent, rejectEvent } from '../../controllers/Admin/event.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/pending', getPendingEvents);
router.post('/approve/:id', approveEvent);
router.post('/reject/:id', rejectEvent);

export default router;

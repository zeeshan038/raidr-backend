import express from 'express';
const router = express.Router();

import { getAllEvents, approveEvent, rejectEvent } from '../../controllers/Admin/event.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/all', getAllEvents);
router.post('/approve/:id', approveEvent);
router.post('/reject/:id', rejectEvent);

export default router;

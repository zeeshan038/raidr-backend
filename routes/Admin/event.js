import express from 'express';
const router = express.Router();

import {
    getAllEvents,
    approveEvent,
    rejectEvent,
    adminCreateLiveEvent,
    adminGetEventById,
    adminUpdateLiveEvent,
    adminDeleteLiveEvent,
} from '../../controllers/Admin/event.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/all', getAllEvents);
router.post('/create', adminCreateLiveEvent);
router.get('/specific-event/:eventId', adminGetEventById);
router.put('/update-event/:eventId', adminUpdateLiveEvent);
router.delete('/delete/:eventId', adminDeleteLiveEvent);
router.post('/approve/:id', approveEvent);
router.post('/reject/:id', rejectEvent);

export default router;

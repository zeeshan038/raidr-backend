import express from 'express';
const router = express.Router();

import { createLiveEvent, getMyEvents, getEventById, updateLiveEvent, deleteEvent } from '../../controllers/Merchant/event.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant);

router.post('/create', createLiveEvent);
router.get('/my-events', getMyEvents);
router.get('/specific-event/:eventId', getEventById);
router.put('/update-event/:eventId', updateLiveEvent);
router.delete('/delete/:eventId', deleteEvent);

export default router;

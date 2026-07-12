import express from 'express';
const router = express.Router();

import { createLiveEvent, getMyEvents, getEventById, updateLiveEvent } from '../../controllers/Merchant/event.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant);

router.post('/create', createLiveEvent);
router.get('/my-events', getMyEvents);
router.get('/:eventId', getEventById);
router.put('/update-event/:eventId', updateLiveEvent);

export default router;

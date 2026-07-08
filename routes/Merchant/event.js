import express from 'express';
const router = express.Router();

import { createLiveEvent, getMyEvents } from '../../controllers/Merchant/event.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant);

router.post('/create', createLiveEvent);
router.get('/my-events', getMyEvents);

export default router;

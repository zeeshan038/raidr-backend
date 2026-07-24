import express from 'express';
const router = express.Router();

import {
    CreateCoinRushEvent,
    GetMerchantCoinRushEvents,
    GetCoinRushQRCheckpoints,
    UpdateCoinRushEvent,
    DeleteCoinRushEvent
} from '../../controllers/Merchant/coinRush.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant);

router.post('/create', CreateCoinRushEvent);
router.get('/my-events', GetMerchantCoinRushEvents);
router.get('/qr-codes/:eventId', GetCoinRushQRCheckpoints);
router.put('/update/:eventId', UpdateCoinRushEvent);
router.delete('/delete/:eventId', DeleteCoinRushEvent);

export default router;

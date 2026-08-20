import express from 'express';
const router = express.Router();

import {
    CreateCoinRushEvent,
    CreateHybridCoinRushEvent,
    GetMerchantCoinRushEvents,
    GetCoinRushQRCheckpoints,
    UpdateCoinRushEvent,
    DeleteCoinRushEvent
} from '../../controllers/Merchant/coinRush.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant);

router.post('/create', CreateCoinRushEvent);
router.post('/hybrid/create', CreateHybridCoinRushEvent);
router.get('/my-events', GetMerchantCoinRushEvents);
router.get('/qr-codes/:eventId', GetCoinRushQRCheckpoints);
router.put('/update/:eventId', UpdateCoinRushEvent);
router.delete('/delete/:eventId', DeleteCoinRushEvent);

export default router;

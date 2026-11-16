import express from 'express';
const router = express.Router();

import {
    getAllCoinRushEvents,
    approveCoinRushEvent,
    rejectCoinRushEvent,
    adminCreateCoinRush,
    adminCreateHybridCoinRush,
    adminUpdateCoinRush,
    adminDeleteCoinRush,
    adminGetCoinRushQRCheckpoints,
} from '../../controllers/Admin/coinRush.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/all', getAllCoinRushEvents);
router.post('/create', adminCreateCoinRush);
router.post('/hybrid/create', adminCreateHybridCoinRush);
router.put('/update/:eventId', adminUpdateCoinRush);
router.delete('/delete/:eventId', adminDeleteCoinRush);
router.get('/qr-codes/:eventId', adminGetCoinRushQRCheckpoints);
router.post('/approve/:id', approveCoinRushEvent);
router.post('/reject/:id', rejectCoinRushEvent);

export default router;

import express from 'express';
const router = express.Router();

import {
    getAllCoinRushEvents,
    approveCoinRushEvent,
    rejectCoinRushEvent,
} from '../../controllers/Admin/coinRush.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/all', getAllCoinRushEvents);
router.post('/approve/:id', approveCoinRushEvent);
router.post('/reject/:id', rejectCoinRushEvent);

export default router;

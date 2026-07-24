import express from 'express';
const router = express.Router();

import {
    GetCoinRushEvents,
    GetCoinRushEventDetails,
    JoinCoinRushEvent,
    SubmitCheckpointCompletion,
    RedeemCoinRushClaim
} from '../controllers/coinRush.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);

router.get('/discovery', GetCoinRushEvents);
router.get('/details/:eventId', GetCoinRushEventDetails);
router.post('/join/:eventId', JoinCoinRushEvent);
router.post('/complete-checkpoint/:eventId', SubmitCheckpointCompletion);
router.post('/redeem/:claimId', RedeemCoinRushClaim);

export default router;

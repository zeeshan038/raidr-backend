import express from 'express';
const router = express.Router();

import { 
    getAllRewards,
    rewardDetail,
    getAllBoxes,
    getUserLiveEventClaims
} from '../controllers/reward.js';

// Middlewares
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);

router.get("/all", getAllRewards);
router.get("/detail/:id", rewardDetail);

// Legacy routes
router.get("/all-boxes", getAllBoxes);
router.get("/live-events/claims", getUserLiveEventClaims);

export default router;
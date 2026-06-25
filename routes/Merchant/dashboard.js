import express from 'express';
const router = express.Router();

import { GetAllCampaigns, GetMyActiveCampaigns, GetDashboardTotalCount, GetImpressionOverTime, GetRewardBreakdown } from '../../controllers/Merchant/dashboard.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';


router.use(verifyMerchant)
router.get('/all', GetAllCampaigns);
router.get('/active-campaigns', GetMyActiveCampaigns);
router.get('/dashboard-total-count', GetDashboardTotalCount);
router.get('/impression-over-time', GetImpressionOverTime);
router.get('/reward-breakdown', GetRewardBreakdown);

export default router;
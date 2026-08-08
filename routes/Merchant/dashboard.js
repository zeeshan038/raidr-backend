import express from 'express';
const router = express.Router();

import { GetAllCampaigns, GetMyActiveCampaigns, GetDashboardTotalCount, GetImpressionOverTime, GetRewardBreakdown, GetPeakActivityHours, GetEventStats } from '../../controllers/Merchant/dashboard.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';


router.use(verifyMerchant)
router.get('/all', GetAllCampaigns);
router.get('/active-campaigns', GetMyActiveCampaigns);
router.get('/dashboard-total-count', GetDashboardTotalCount);
router.get('/impression-over-time', GetImpressionOverTime);
router.get('/reward-breakdown', GetRewardBreakdown);
router.get('/peak-activity', GetPeakActivityHours);
router.get('/event-stats', GetEventStats);

export default router;
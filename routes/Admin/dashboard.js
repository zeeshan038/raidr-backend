import express from 'express';
const router = express.Router();

import { 
    getDashboardMetrics,
    getUserGrowthChart,
    getMerchantGrowthChart,
    getRecentMerchants,
    getUpcomingEvents
} from '../../controllers/Admin/dashboard.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/metrics', getDashboardMetrics);
router.get('/charts/users', getUserGrowthChart);
router.get('/charts/merchants', getMerchantGrowthChart);
router.get('/recent-merchants', getRecentMerchants);
router.get('/upcoming-events', getUpcomingEvents);

export default router;

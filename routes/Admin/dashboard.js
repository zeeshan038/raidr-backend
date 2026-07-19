import express from 'express';
const router = express.Router();

import { 
    getDashboardMetrics,
    getUserGrowthChart,
    getMerchantGrowthChart
} from '../../controllers/Admin/dashboard.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/metrics', getDashboardMetrics);
router.get('/charts/users', getUserGrowthChart);
router.get('/charts/merchants', getMerchantGrowthChart);

export default router;

import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"
import TripRoutes from "./trip.js"
import UploadRoutes from "./upload.js"

//Merchant 
import MerchantRoutes from "./Merchant/merchant.js"
import AdsRoutes from "./Merchant/ads.js"
import DashboardRoutes from "./Merchant/dashboard.js"

//Merchant Routes
router.use('/merchant',MerchantRoutes);
router.use('/merchant/ads',AdsRoutes);
router.use("/merchant/dashboard",DashboardRoutes);


//User Routes
router.use("/user",UserRoutes);
router.use("/trip",TripRoutes);
router.use("/upload",UploadRoutes);

 
export default router;
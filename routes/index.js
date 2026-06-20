import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"
import TripRoutes from "./trip.js"

//Merchant 
import MerchantRoutes from "./Merchant/merchant.js"
import AdsRoutes from "./Merchant/ads.js"

//Merchant Routes
router.use('/merchant',MerchantRoutes);
router.use('/ads',AdsRoutes);


//User Routes
router.use("/user",UserRoutes);
router.use("/trip",TripRoutes);


export default router;
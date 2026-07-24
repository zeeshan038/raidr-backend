import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"
import TripRoutes from "./trip.js"
import UploadRoutes from "./upload.js"
import UserStoreRoutes from './store.js'
import EventRoutes from './events.js'
import TestRoutes from './test.js'

//Merchant 
import MerchantRoutes from "./Merchant/merchant.js"
import AdsRoutes from "./Merchant/ads.js"
import DashboardRoutes from "./Merchant/dashboard.js"
import PaymentRoutes from "./Merchant/payment.js"
import MerchantEventRoutes from "./Merchant/event.js"
import MerchantCoinRushRoutes from "./Merchant/coinRush.js"

//Admin
import AdminStoreRoutes from "./Admin/store.js"
import AdminAuthRoutes from "./Admin/admin.js"
import AdminEventRoutes from "./Admin/event.js"
import UserManagmentRoutes from "./Admin/userManagment.js"
import MerchantManagmentRoutes from "./Admin/merchantManagement.js"
import AdminDashboardRoutes from "./Admin/dashboard.js"

//Merchant Routes 
router.use('/merchant/ads',AdsRoutes);
router.use("/merchant/dashboard",DashboardRoutes);
router.use('/merchant/payments', PaymentRoutes);
router.use('/merchant/events', MerchantEventRoutes);
router.use('/merchant/coin-rush', MerchantCoinRushRoutes);
router.use('/merchant',MerchantRoutes);


//User Routes
import CoinRushRoutes from './coinRush.js'
router.use("/user",UserRoutes);
router.use("/trip",TripRoutes);
router.use("/upload",UploadRoutes);
router.use('/store',UserStoreRoutes);
router.use('/events',EventRoutes)
router.use('/coin-rush', CoinRushRoutes)

//Admin 
router.use("/admin/store",AdminStoreRoutes)
router.use("/admin",AdminAuthRoutes)
router.use("/admin/events",AdminEventRoutes)
router.use("/admin/user",UserManagmentRoutes)
router.use("/admin/merchants",MerchantManagmentRoutes)
router.use("/admin/dashboard",AdminDashboardRoutes)

//Test
router.use("/test", TestRoutes)
 
export default router;
import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"
import TripRoutes from "./trip.js"
import UploadRoutes from "./upload.js"
import UserStoreRoutes from './store.js'
import EventRoutes from './events.js'

//Merchant 
import MerchantRoutes from "./Merchant/merchant.js"
import AdsRoutes from "./Merchant/ads.js"
import DashboardRoutes from "./Merchant/dashboard.js"
import PaymentRoutes from "./Merchant/payment.js"
import MerchantEventRoutes from "./Merchant/event.js"

//Admin
import AdminStoreRoutes from "./Admin/store.js"
import AdminAuthRoutes from "./Admin/admin.js"
import AdminEventRoutes from "./Admin/event.js"

//Merchant Routes
router.use('/merchant/ads',AdsRoutes);
router.use("/merchant/dashboard",DashboardRoutes);
router.use('/merchant/payments', PaymentRoutes);
router.use('/merchant/events', MerchantEventRoutes);
router.use('/merchant',MerchantRoutes);


//User Routes
router.use("/user",UserRoutes);
router.use("/trip",TripRoutes);
router.use("/upload",UploadRoutes);
router.use('/store',UserStoreRoutes);
router.use('/events',EventRoutes)

//Admin 
router.use("/admin/store",AdminStoreRoutes)
router.use("/admin",AdminAuthRoutes)
router.use("/admin/events",AdminEventRoutes)

 
export default router;
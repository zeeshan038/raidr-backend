import express from 'express';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';
import {
    createCoinPaymentIntent,
    stripeWebhooks,
    getBillingHistory,
    getMerchantPurchaseHistory
} from '../../controllers/Merchant/payment.js';

const router = express.Router();

router.post('/webhook', stripeWebhooks);

router.use(verifyMerchant)
router.post('/create-intent', createCoinPaymentIntent);
router.get('/history', getBillingHistory);
router.get('/purchase-history', getMerchantPurchaseHistory);

export default router;
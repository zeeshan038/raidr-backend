import express from 'express';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';
import { createCoinPaymentIntent, stripeWebhooks } from '../../controllers/Merchant/payment.js';

const router = express.Router();

router.use(verifyMerchant)
router.post('/create-intent', createCoinPaymentIntent);
router.post('/webhook', stripeWebhooks);


export default router;    
import express from 'express';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';
import { createCoinPaymentIntent, stripeWebhooks } from '../../controllers/Merchant/payment.js';

const router = express.Router();

// Webhooks do not use JWT auth (they use Stripe signatures), so define them BEFORE verifyMerchant
router.post('/webhook', stripeWebhooks);

router.use(verifyMerchant)
router.post('/create-intent', createCoinPaymentIntent);

export default router;    
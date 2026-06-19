import express from 'express';
import { Register, Login } from '../controllers/Merchant/merchant.js';
import { createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign, toggleCampaignStatus } from '../controllers/Merchant/ads.js';
import { verifyMerchant } from '../middlewares/verifyMerchant.js';

const router = express.Router();

// Merchant Authentication Routes
router.post('/register', Register);
router.post('/login', Login);

// Merchant Ads/Campaigns Routes
router.post('/ads', verifyMerchant, createCampaign);
router.get('/ads', verifyMerchant, getCampaigns);
router.get('/ads/:id', verifyMerchant, getCampaignById);
router.put('/ads/:id', verifyMerchant, updateCampaign);
router.delete('/ads/:id', verifyMerchant, deleteCampaign);
router.patch('/ads/:id/status', verifyMerchant, toggleCampaignStatus);

export default router;

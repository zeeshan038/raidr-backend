//NPM Packages
import express from 'express';
const router = express.Router();

//Controllers
import { createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign, toggleCampaignStatus } from '../../controllers/Merchant/ads.js';

//middleware
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';

router.use(verifyMerchant)
router.post('/create', createCampaign);
router.get('/get-all-campaigns', getCampaigns);
router.get('/get-campaign/:id', getCampaignById);
router.put('/update-campaign/:id', updateCampaign);
router.delete('/delete-campaign/:id', deleteCampaign);
router.patch('/toggle-campaign-status/:id', toggleCampaignStatus);

export default router;
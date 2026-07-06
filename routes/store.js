import express from 'express'
const router = express.Router();
import { getStoreAvatars, getMyAvatars, purchaseAvatar, PurchaseCoins } from '../controllers/store.js';

import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);
router.get('/all-items',  getStoreAvatars);
router.get('/my-avatars',  getMyAvatars);
router.post('/purchase',  purchaseAvatar);
router.post('/purchase-coins',  PurchaseCoins);

export default router;

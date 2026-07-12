import express from 'express';
const router = express.Router();

import { Register, Login, WhoAmI, GetCredits} from '../../controllers/Merchant/merchant.js';
import { verifyMerchant } from '../../middlewares/verifyMerchant.js';



router.post('/register', Register);
router.post('/login', Login);

router.use(verifyMerchant)
router.get("/whoami",WhoAmI)
router.get("/credits",GetCredits)



export default router;
 
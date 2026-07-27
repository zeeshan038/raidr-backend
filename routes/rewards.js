import express from 'express';
const router = express.Router();

import { 
    getAllRewards, 

} from '../controllers/reward.js';

// Middlewares
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);

router.get("/all", getAllRewards);


export default router;
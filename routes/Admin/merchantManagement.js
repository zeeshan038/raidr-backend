import express from 'express';
const router = express.Router();

import { 
    getAllMerchants, 
    getMerchantById, 
    updateMerchantById, 
    deleteMerchantById 
} from '../../controllers/Admin/merchantManagement.js';

import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.use(verifyAdmin);

router.get('/', getAllMerchants);
router.get('/:id', getMerchantById);
router.put('/update/:id', updateMerchantById);
router.delete('/delete/:id', deleteMerchantById);

export default router;

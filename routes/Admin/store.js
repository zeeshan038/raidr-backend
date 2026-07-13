import express from 'express'
const router = express.Router();

import { CreateAvatar, getAllStoreItems, updateStoreItem, deleteStoreItem } from '../../controllers/Admin/store.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';


router.use(verifyAdmin)
router.post('/create', CreateAvatar);
router.get('/get-all', getAllStoreItems);
router.put('/update/:id', updateStoreItem);
router.delete('/delete/:id', deleteStoreItem);


export default router;
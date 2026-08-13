import express from 'express';
const router = express.Router();

import { registerAdmin, loginAdmin } from '../../controllers/Admin/admin.js';
import { verifyAdmin } from '../../middlewares/verifyAdmin.js';

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

export default router;

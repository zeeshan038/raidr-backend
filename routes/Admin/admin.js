import express from 'express';
const router = express.Router();

import { registerAdmin, loginAdmin } from '../../controllers/Admin/admin.js';

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

export default router;

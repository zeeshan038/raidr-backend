import express from 'express';
const router = express.Router();

import { Register, Login } from '../../controllers/Merchant/merchant.js';


router.post('/register', Register);
router.post('/login', Login);



export default router;

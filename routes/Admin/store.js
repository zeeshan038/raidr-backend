import express from 'express'
const router = express.Router();

import { CreateAvatar } from '../../controllers/Admin/store.js';


router.post('/create', CreateAvatar);


export default router;
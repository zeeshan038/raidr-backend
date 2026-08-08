import express from 'express';
import { addReview } from '../controllers/review.js';
import { verifyUser } from '../middlewares/verifyUser.js';

const router = express.Router();

router.use(verifyUser);
router.post('/add', addReview);

export default router;

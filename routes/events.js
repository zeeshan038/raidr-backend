import express from 'express'
const router = express.Router();

import { GetEvents,JoinEvent,GetMyEvents } from '../controllers/event.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);
router.get('/discovery',GetEvents);
router.post('/join-event/:eventId',JoinEvent);
router.get('/my-events',GetMyEvents);

export default router;

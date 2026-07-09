import express from 'express'
const router = express.Router();

import {
    GetEvents,
    JoinEvent,
    GetMyEvents,
    claimLiveEventReward,
    eventDetails
} from '../controllers/event.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);

// Routes
router.get('/discovery', GetEvents);
router.get('/details/:eventId', eventDetails);
router.post('/join-event/:eventId', JoinEvent);
router.get('/my-events', GetMyEvents);
router.post('/claim/:eventId', claimLiveEventReward);

export default router;

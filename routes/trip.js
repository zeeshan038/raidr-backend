// NPM Packages 
import express from 'express';
const router = express.Router();

import {
    GetCityWeather,
    PlanYourTrip,
    SkipYourTrip,
    SaveJourney,
    GetMyTrips,
    StartAndPauseTrip,
    getTripDetails,
    getMerchantAds,
    recordAdImpression,
    claimReward,
    surpriseMe,
    claimLiveEventReward
} from '../controllers/trip.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);
router.get('/weather', GetCityWeather);
router.post('/plan-trip', PlanYourTrip);
router.post('/skip-trip', SkipYourTrip);
router.post('/save-journey', SaveJourney);
router.post('/start-pause-trip', StartAndPauseTrip);
router.get("/my-trips", GetMyTrips);
router.get('/trip-details/:tripId', getTripDetails);
router.get("/banner", getMerchantAds);
router.post('/impression/:adId', recordAdImpression);
router.post('/banner/claim/:adId', claimReward);
router.post('/live-event/claim/:eventId', claimLiveEventReward);
router.get('/surprise-me', surpriseMe);

export default router;
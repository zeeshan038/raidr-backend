// NPM Packages 
import express from 'express';
const router = express.Router();

import { GetCityWeather, PlanYourTrip, SkipYourTrip, SaveJourney, GetMyTrips, ToggleTripStatus } from '../controllers/trip.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);
router.get('/weather',GetCityWeather);
router.post('/plan-trip',PlanYourTrip);
router.post('/skip-trip',SkipYourTrip);
router.post('/save-journey',SaveJourney);
router.post('/toggle-status', ToggleTripStatus);
router.get("/my-trips",GetMyTrips);

export default router;
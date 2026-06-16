// NPM Packages 
import express from 'express';
const router = express.Router();

import { GetCityWeather, PlanYourTrip } from '../controllers/trip.js';
import { verifyUser } from '../middlewares/verifyUser.js';

router.use(verifyUser);
router.get('/weather',GetCityWeather);
router.post('/plan-trip',PlanYourTrip);


export default router;
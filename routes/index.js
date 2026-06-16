import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"
import TripRoutes from "./trip.js"

//User Routes
router.use("/user",UserRoutes);
router.use("/trip",TripRoutes);


export default router;
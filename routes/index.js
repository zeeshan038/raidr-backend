import express from 'express';
const router = express.Router();

//Paths
import UserRoutes from "./user.js"

//User Routes
router.use("/user",UserRoutes);


export default router;
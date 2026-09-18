import express from "express";
import { getZones, startCapture, completeCapture, getDailyDrop, collectDailyDrop, getActiveTheme, getSinglePlayerHistory, getSinglePlayerDashboard, getUserVouchers } from "../controllers/singlePlayer.js";
import { verifyUser } from "../middlewares/verifyUser.js";

const router = express.Router();


router.use(verifyUser)
router.get("/zones", getZones);
router.post("/zones/:id/capture/start", startCapture);
router.post("/zones/:id/capture/complete", completeCapture);

router.post("/daily-drop", getDailyDrop);
router.post("/daily-drop/collect", collectDailyDrop);

router.get("/theme", getActiveTheme);

router.get("/history", getSinglePlayerHistory);

router.get("/dashboard", getSinglePlayerDashboard);

router.get("/vouchers", getUserVouchers);

export default router;

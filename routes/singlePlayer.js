import express from "express";
import {
  getZones,
  getZoneById,
  getGameConfigForUser,
  startCapture,
  pingCapture,
  cancelCapture,
  completeCapture,
  getDailyDrop,
  collectDailyDrop,
  getActiveTheme,
  getSinglePlayerHistory,
  getSinglePlayerDashboard,
  getUserVouchers,
} from "../controllers/singlePlayer.js";
import {
  getActiveBrandMonth,
  getBrandMonthHistory,
  claimBrandMonthReward,
} from "../controllers/singlePlayerBrandMonth.js";
import {
  getGuardInventory,
  purchaseGuards,
  assignGuardsToZone,
  unassignGuardsFromZone,
  eliminateGuardsDuringCapture,
} from "../controllers/singlePlayerGuards.js";
import { getEmpire } from "../controllers/singlePlayerEmpire.js";
import {
  claimB2bReward,
  listMyB2bClaims,
  redeemB2bClaim,
} from "../controllers/singlePlayerB2b.js";
import { verifyUser } from "../middlewares/verifyUser.js";

const router = express.Router();


router.use(verifyUser);

router.get("/zones", getZones);
router.get("/zones/:id", getZoneById);
router.get("/game-config", getGameConfigForUser);
router.get("/empire", getEmpire);
router.get("/b2b/claims", listMyB2bClaims);
router.post("/b2b/claims/:claimId/redeem", redeemB2bClaim);
router.post("/zones/:id/b2b/claim", claimB2bReward);
router.get("/guards/inventory", getGuardInventory);
router.post("/guards/purchase", purchaseGuards);
router.post("/zones/:id/guards/assign", assignGuardsToZone);
router.post("/zones/:id/guards/unassign", unassignGuardsFromZone);
router.post("/zones/:id/capture/start", startCapture);
router.post("/zones/:id/capture/ping", pingCapture);
router.post("/zones/:id/capture/cancel", cancelCapture);
router.post("/zones/:id/capture/eliminate-guards", eliminateGuardsDuringCapture);
router.post("/zones/:id/capture/complete", completeCapture);
router.post("/daily-drop", getDailyDrop);
router.post("/daily-drop/collect", collectDailyDrop);
router.get("/theme", getActiveTheme);
router.get("/history", getSinglePlayerHistory);
router.get("/dashboard", getSinglePlayerDashboard);
router.get("/vouchers", getUserVouchers);
router.get("/brand-month/active", getActiveBrandMonth);
router.get("/brand-month/history", getBrandMonthHistory);
router.post("/brand-month/:campaignId/claim", claimBrandMonthReward);

export default router;

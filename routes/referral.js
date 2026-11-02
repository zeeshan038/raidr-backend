import express from "express";
import {
  getMyReferralCode,
  getReferralStats,
  redeemReferralReward,
  validateReferralCode,
} from "../controllers/referral.js";
import { verifyUser } from "../middlewares/verifyUser.js";

const router = express.Router();

router.post("/validate", validateReferralCode);

router.use(verifyUser);
router.get("/my-code", getMyReferralCode);
router.get("/stats", getReferralStats);
router.post("/redeem", redeemReferralReward);

export default router;

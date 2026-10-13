import express from "express";
import { verifyMerchant } from "../../middlewares/verifyMerchant.js";
import {
  createB2bZone,
  updateB2bZone,
  listMyB2bZones,
} from "../../controllers/Merchant/singlePlayerZone.js";
import { merchantB2bAiDraft } from "../../controllers/Merchant/singlePlayerAi.js";

const router = express.Router();

router.use(verifyMerchant);

router.post("/b2b-zones/ai-draft", merchantB2bAiDraft);
router.post("/b2b-zones", createB2bZone);
router.put("/b2b-zones/:id", updateB2bZone);
router.get("/b2b-zones", listMyB2bZones);

export default router;

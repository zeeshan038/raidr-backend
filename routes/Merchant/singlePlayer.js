import express from "express";
import { verifyMerchant } from "../../middlewares/verifyMerchant.js";
import {
  createB2bZone,
  updateB2bZone,
  listMyB2bZones,
  getB2bApprovalSignal,
} from "../../controllers/Merchant/singlePlayerZone.js";
import { merchantB2bAiDraft, merchantB2bGenerateImages } from "../../controllers/Merchant/singlePlayerAi.js";
import {
  merchantListSilentDrops,
  merchantCreateSilentDrop,
  merchantUpdateSilentDrop,
  merchantGetSilentDrop,
  merchantDeleteSilentDrop,
  merchantGenerateSilentDropImages,
} from "../../controllers/Merchant/silentDrop.js";

const router = express.Router();

router.use(verifyMerchant);

router.post("/b2b-zones/ai-draft", merchantB2bAiDraft);
router.post("/b2b-zones/generate-images", merchantB2bGenerateImages);
router.get("/b2b-zones/approval-signal", getB2bApprovalSignal);
router.post("/b2b-zones", createB2bZone);
router.put("/b2b-zones/:id", updateB2bZone);
router.get("/b2b-zones", listMyB2bZones);

router.get("/silent-drops", merchantListSilentDrops);
router.post("/silent-drops/generate-images", merchantGenerateSilentDropImages);
router.post("/silent-drops", merchantCreateSilentDrop);
router.get("/silent-drops/:id", merchantGetSilentDrop);
router.put("/silent-drops/:id", merchantUpdateSilentDrop);
router.delete("/silent-drops/:id", merchantDeleteSilentDrop);

export default router;

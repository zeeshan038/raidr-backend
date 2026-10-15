import express from "express";
import {
  createZone,
  getAllZones,
  updateZone,
  deleteZone,
  generateBulkZonesController,
} from "../../controllers/Admin/singlePlayer.js";
import { getGameConfig, updateGameConfig } from "../../controllers/Admin/singlePlayerConfig.js";
import {
  listPendingB2bZones,
  approveB2bZone,
  rejectB2bZone,
  getB2bPendingSignal,
} from "../../controllers/Admin/singlePlayerB2b.js";
import { adminB2bAiDraft } from "../../controllers/Admin/singlePlayerAi.js";
import { verifyAdmin } from "../../middlewares/verifyAdmin.js"; // Assuming you have verifyAdmin middleware

const router = express.Router();

router.use(verifyAdmin);

router.post("/create", createZone);
router.post("/zones/bulk-generate", generateBulkZonesController);
router.get("/zones", getAllZones);
router.put("/zones/:id", updateZone);
router.delete("/delete/:id", deleteZone);
router.get("/config", getGameConfig);
router.put("/config", updateGameConfig);
router.post("/b2b/ai-draft", adminB2bAiDraft);
router.get("/b2b/pending", listPendingB2bZones);
router.get("/b2b/pending/signal", getB2bPendingSignal);
router.post("/b2b/:id/approve", approveB2bZone);
router.post("/b2b/:id/reject", rejectB2bZone);

export default router;

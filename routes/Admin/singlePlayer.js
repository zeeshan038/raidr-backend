import express from "express";
import {
  createZone,
  getAllZones,
  updateZone,
  deleteZone,
  generateBulkZonesController,
} from "../../controllers/Admin/singlePlayer.js";
import { verifyAdmin } from "../../middlewares/verifyAdmin.js"; // Assuming you have verifyAdmin middleware

const router = express.Router();

router.use(verifyAdmin);

router.post("/create", createZone);
router.post("/zones/bulk-generate", generateBulkZonesController);
router.get("/zones", getAllZones);
router.put("/zones/:id", updateZone);
router.delete("/delete/:id", deleteZone);

export default router;

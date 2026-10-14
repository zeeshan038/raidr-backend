import express from "express";
import { verifyAdmin } from "../../middlewares/verifyAdmin.js";
import {
  createBrandMonthCampaign,
  listBrandMonthCampaigns,
  getBrandMonthCampaignById,
  updateBrandMonthCampaign,
  deleteBrandMonthCampaign,
} from "../../controllers/Admin/brandMonth.js";

const router = express.Router();

router.use(verifyAdmin);

router.post("/", createBrandMonthCampaign);
router.get("/", listBrandMonthCampaigns);
router.get("/:id", getBrandMonthCampaignById);
router.put("/:id", updateBrandMonthCampaign);
router.delete("/:id", deleteBrandMonthCampaign);

export default router;

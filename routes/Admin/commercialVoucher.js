import express from "express";
import {
  createVoucher,
  getVouchers,
  updateVoucher,
  deleteVoucher
} from "../../controllers/Admin/commercialVoucher.js";

const router = express.Router();

router.post("/", createVoucher);
router.get("/", getVouchers);
router.put("/:id", updateVoucher);
router.delete("/:id", deleteVoucher);

export default router;

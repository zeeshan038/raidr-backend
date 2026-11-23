import express from "express";
import { verifyAdmin } from "../../middlewares/verifyAdmin.js";
import {
  adminCreateMerchantNfcTag,
  adminListMerchantNfcTags,
  adminListMerchantNfcVisits,
} from "../../controllers/Admin/nfc.js";

const router = express.Router();

router.use(verifyAdmin);
router.get("/merchants/:merchantId/tags", adminListMerchantNfcTags);
router.post("/merchants/:merchantId/tags", adminCreateMerchantNfcTag);
router.get("/merchants/:merchantId/visits", adminListMerchantNfcVisits);

export default router;

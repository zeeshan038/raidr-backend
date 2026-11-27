import express from "express";
import { verifyMerchant } from "../../middlewares/verifyMerchant.js";
import {
  merchantCreateNfcTag,
  merchantListNfcTags,
  merchantListNfcVisits,
} from "../../controllers/Merchant/nfc.js";

const router = express.Router();

router.use(verifyMerchant);
router.get("/tags", merchantListNfcTags);
router.post("/tags", merchantCreateNfcTag);
router.get("/visits", merchantListNfcVisits);

export default router;

import express from "express";
import { verifyUser } from "../middlewares/verifyUser.js";
import { getMyNfcVisits, verifyNfcTap } from "../controllers/nfc.js";

const router = express.Router();

router.use(verifyUser);
router.post("/verify", verifyNfcTap);
router.get("/my-visits", getMyNfcVisits);

export default router;

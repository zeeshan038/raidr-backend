import express from "express";
import multer from "multer";
import { verifyUser } from "../middlewares/verifyUser.js";
import {
  getMyNfcVisits,
  submitNfcReceiptPhoto,
  verifyNfcTap,
} from "../controllers/nfc.js";

const router = express.Router();

const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a valid image file."), false);
    }
  },
});

const runReceiptUpload = (req, res, next) => {
  uploadReceipt.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        status: false,
        msg: "Image too large (max 10MB)",
      });
    }
    return res.status(400).json({
      status: false,
      msg: err.message || "Invalid image upload",
    });
  });
};

router.use(verifyUser);
router.post("/verify", verifyNfcTap);
router.get("/my-visits", getMyNfcVisits);
router.post("/receipt", runReceiptUpload, submitNfcReceiptPhoto);

export default router;

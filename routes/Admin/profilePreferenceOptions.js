import express from "express";
import { verifyAdmin } from "../../middlewares/verifyAdmin.js";
import {
  listProfilePreferenceOptions,
  createProfilePreferenceOption,
  updateProfilePreferenceOption,
  deleteProfilePreferenceOption,
} from "../../controllers/Admin/profilePreferenceOptions.js";

const router = express.Router();

router.use(verifyAdmin);

router.get("/", listProfilePreferenceOptions);
router.post("/", createProfilePreferenceOption);
router.put("/:id", updateProfilePreferenceOption);
router.delete("/:id", deleteProfilePreferenceOption);

export default router;

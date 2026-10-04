import express from "express";
import {
    createTheme,
    getThemes,
    updateTheme,
    deleteTheme,
    generateThemeImagesController
} from "../../controllers/Admin/sponsoredTheme.js";

const router = express.Router();

router.post("/generate-images", generateThemeImagesController);
router.post("/", createTheme);
router.get("/", getThemes);
router.put("/:id", updateTheme);
router.delete("/:id", deleteTheme);

export default router;

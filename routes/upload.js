import express from "express";
const router = express.Router();

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Helper to sanitize filenames for object storage
function sanitizeBlobName(name) {
    return name ? name.replace(/[^a-zA-Z0-9.-]/g, "_") : "file";
}

// Compression Packages
import sharp from "sharp";

// Multer
import multer from "multer";
const storage = multer.memoryStorage();
const uploadImage = multer({ storage: storage, fileFilter: imageFilter });

// Functions
function imageFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb("Please upload a valid image file.", false);
    }
}

// Upload Image Route
router.route("/image").post(uploadImage.single("image"), async (req, res) => {
    // Use HETZNER_BUCKET from .env, fallback to query param, fallback to "images"
    const containerName = process.env.HETZNER_BUCKET || req.query.containerName || "images";

    // Optional: Allow organizing files into folders (e.g., ?folder=merchants)
    const folderName = req.query.folder ? `${req.query.folder}/` : "";

    // Initialize S3 Client for Hetzner Object Storage
    const s3Client = new S3Client({
        endpoint: process.env.HETZNER_ENDPOINT || "https://fsn1.your-objectstorage.com",
        region: process.env.HETZNER_REGION || "fsn1",
        forcePathStyle: true, // REQUIRED for Hetzner and other S3-compatible services
        credentials: {
            accessKeyId: process.env.HETZNER_ACCESS_KEY,
            secretAccessKey: process.env.HETZNER_SECRET_KEY,
        },
    });

    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        // Compress Image
        const compressedImageBuffer = await sharp(req.file.buffer)
            .toFormat("jpeg")
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

        // Generate a unique blob name (includes folder if provided)
        const fileName = `${Date.now()}_${sanitizeBlobName(req.file.originalname)}`;
        const blobName = `${folderName}${fileName}`;

        // Upload the image to Hetzner Object Storage
        const command = new PutObjectCommand({
            Bucket: containerName,
            Key: blobName,
            Body: compressedImageBuffer,
            ContentType: "image/jpeg",
            ACL: "public-read", // Makes the image publicly accessible
        });

        await s3Client.send(command);

        // Generate the public URL
        // Ensure endpoint doesn't have a trailing slash before appending
        const endpoint = (process.env.HETZNER_ENDPOINT || "https://fsn1.your-objectstorage.com").replace(/\/$/, "");
        const url = `${endpoint}/${containerName}/${blobName}`;

        // Response
        return res.status(200).json({
            success: true,
            url: url,
            msg: "Image Uploaded and Compressed successfully",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ errors: error.message || error });
    }
});

export default router;
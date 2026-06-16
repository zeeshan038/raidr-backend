import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate credentials
if (!process.env.HETZNER_ACCESS_KEY || !process.env.HETZNER_SECRET_KEY) {
  console.error("❌ Missing Hetzner credentials in .env file.");
  console.error("Please add HETZNER_ACCESS_KEY and HETZNER_SECRET_KEY to your .env");
  process.exit(1);
}

// Initialize S3 Client for Hetzner
const s3Client = new S3Client({
  region: 'hel1', // Based on your endpoint URL
  endpoint: 'https://hel1.your-objectstorage.com',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.HETZNER_ACCESS_KEY,
    secretAccessKey: process.env.HETZNER_SECRET_KEY,
  },
});

const BUCKET_NAME = 'raidr-assets';

async function uploadFile(filePath, fileName) {
  const fileContent = fs.readFileSync(filePath);
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: `avatars/${fileName}`, 
    Body: fileContent,
    ContentType: 'image/png', 
    ACL: 'public-read'
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    console.log(`✅ Successfully uploaded: ${fileName}`);
  } catch (err) {
    console.error(`❌ Error uploading ${fileName}:`, err.message);
  }
}

async function main() {
  console.log("Starting upload of avatars...");
  
  // Find all 1 to 10 back and front pngs
  const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.png') && (file.includes('_front') || file.includes('_back')));
  
  if (files.length === 0) {
    console.log("No avatar PNGs found in the current directory.");
    return;
  }

  console.log(`Found ${files.length} avatar images. Uploading to ${BUCKET_NAME}...`);
  
  // Upload all files in parallel
  const uploadPromises = files.map(file => uploadFile(path.join(__dirname, file), file));
  
  await Promise.all(uploadPromises);
  
  console.log("🎉 All uploads finished!");
}

main();

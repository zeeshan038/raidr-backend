import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { prisma } from "../../config/db.js";
import { awardRaidrCoins } from "../economyConfig.js";
import { awardUserXp } from "../awardUserXp.js";
import {
  NFC_RECEIPT_COIN_SOURCE,
  NFC_RECEIPT_SUBMIT_WINDOW_HOURS,
} from "./constants.js";
import {
  buildReceiptFingerprint,
  computeReceiptBonus,
  isReceiptDateToday,
} from "./receiptRewards.js";
import { extractReceiptFromImage } from "./receiptVision.js";

const downloadImageBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download receipt image (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: contentType.split(";")[0].trim() };
};

const uploadReceiptBuffer = async (buffer, originalName = "receipt.jpg") => {
  const containerName = process.env.HETZNER_BUCKET || "images";
  const s3Client = new S3Client({
    endpoint: process.env.HETZNER_ENDPOINT || "https://fsn1.your-objectstorage.com",
    region: process.env.HETZNER_REGION || "fsn1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.HETZNER_ACCESS_KEY,
      secretAccessKey: process.env.HETZNER_SECRET_KEY,
    },
  });

  const compressed = await sharp(buffer)
    .rotate()
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const safe = String(originalName || "receipt").replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `nfc-receipts/${Date.now()}_${safe.replace(/\.[^.]+$/, "")}.jpg`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: containerName,
      Key: key,
      Body: compressed,
      ContentType: "image/jpeg",
      ACL: "public-read",
    })
  );

  const endpoint = (
    process.env.HETZNER_ENDPOINT || "https://fsn1.your-objectstorage.com"
  ).replace(/\/$/, "");
  return {
    url: `${endpoint}/${containerName}/${key}`,
    buffer: compressed,
    mimeType: "image/jpeg",
  };
};

/**
 * Submit a live-camera receipt photo for an NFC visit.
 */
export const submitNfcReceipt = async ({
  userId,
  visitId,
  imageUrl = null,
  imageBuffer = null,
  imageMimeType = null,
  originalName = "receipt.jpg",
  captureSource,
}) => {
  if (String(captureSource || "").toLowerCase() !== "camera") {
    return {
      ok: false,
      status: 400,
      msg: "Receipt must be a live camera snap (captureSource=camera). Gallery uploads are not allowed.",
    };
  }

  if (!visitId) {
    return { ok: false, status: 400, msg: "visitId is required" };
  }

  const visit = await prisma.nfcVisit.findUnique({
    where: { id: visitId },
    include: {
      merchant: {
        select: { id: true, name: true, businessName: true },
      },
      receipt: { select: { id: true, status: true } },
    },
  });

  if (!visit) {
    return { ok: false, status: 404, msg: "NFC visit not found" };
  }
  if (visit.userId !== userId) {
    return { ok: false, status: 403, msg: "This visit does not belong to you" };
  }
  if (visit.receipt) {
    return {
      ok: false,
      status: 409,
      msg: "A receipt was already submitted for this visit",
    };
  }

  const windowMs = NFC_RECEIPT_SUBMIT_WINDOW_HOURS * 60 * 60 * 1000;
  if (Date.now() - new Date(visit.createdAt).getTime() > windowMs) {
    return {
      ok: false,
      status: 400,
      msg: `Receipt must be submitted within ${NFC_RECEIPT_SUBMIT_WINDOW_HOURS}h of the NFC tap`,
    };
  }

  let workingBuffer;
  let mimeType;
  let finalImageUrl;

  try {
    if (imageBuffer?.length) {
      const uploaded = await uploadReceiptBuffer(imageBuffer, originalName);
      workingBuffer = uploaded.buffer;
      mimeType = uploaded.mimeType;
      finalImageUrl = uploaded.url;
    } else if (imageUrl) {
      finalImageUrl = String(imageUrl).trim();
      const downloaded = await downloadImageBuffer(finalImageUrl);
      workingBuffer = downloaded.buffer;
      mimeType = imageMimeType || downloaded.mimeType;
    } else {
      return {
        ok: false,
        status: 400,
        msg: "Provide multipart image or imageUrl",
      };
    }
  } catch (err) {
    console.error("[NFC receipt] image prep failed:", err);
    return { ok: false, status: 400, msg: err.message || "Invalid receipt image" };
  }

  const imageSha256 = crypto.createHash("sha256").update(workingBuffer).digest("hex");

  const existingHash = await prisma.nfcReceipt.findUnique({
    where: { imageSha256 },
    select: { id: true },
  });
  if (existingHash) {
    return {
      ok: false,
      status: 409,
      msg: "This receipt photo was already submitted",
    };
  }

  const extraction = await extractReceiptFromImage({
    buffer: workingBuffer,
    mimeType,
  });

  if (!extraction.ok) {
    return {
      ok: false,
      status: 422,
      msg: extraction.error || "Could not read receipt",
    };
  }

  if (!isReceiptDateToday(extraction.receiptDateKey)) {
    return {
      ok: false,
      status: 400,
      msg: "Receipt date must be today. Old receipts are not accepted.",
      data: { receiptDate: extraction.receiptDateKey },
    };
  }

  const bonus = computeReceiptBonus(extraction.amountIls);
  if (!bonus.ok) {
    return { ok: false, status: 400, msg: bonus.error };
  }

  const fingerprint = buildReceiptFingerprint({
    merchantId: visit.merchantId,
    dateKey: extraction.receiptDateKey,
    amountIls: bonus.amountIls,
  });

  const existingFp = await prisma.nfcReceipt.findUnique({
    where: {
      userId_fingerprint: { userId, fingerprint },
    },
    select: { id: true },
  });
  if (existingFp) {
    return {
      ok: false,
      status: 409,
      msg: "Duplicate receipt: you already submitted this purchase amount today for this merchant",
    };
  }

  let coinsAwarded = bonus.coinsAwarded;
  let xpAwarded = bonus.xpAwarded;
  let xpResult = null;

  try {
    if (coinsAwarded > 0) {
      await awardRaidrCoins(prisma, userId, coinsAwarded, NFC_RECEIPT_COIN_SOURCE);
    }
    if (xpAwarded > 0) {
      xpResult = await awardUserXp(prisma, userId, xpAwarded, {
        skipBrandMonth: false,
        brandMonthCoords:
          visit.latitude != null && visit.longitude != null
            ? { lat: visit.latitude, lng: visit.longitude }
            : null,
      });
    }

    const receipt = await prisma.nfcReceipt.create({
      data: {
        visitId: visit.id,
        userId,
        merchantId: visit.merchantId,
        imageUrl: finalImageUrl,
        imageSha256,
        fingerprint,
        amountIls: bonus.amountIls,
        currency: extraction.currency || "ILS",
        receiptDatedAt: extraction.receiptDatedAt,
        captureSource: "camera",
        status: "approved",
        coinsAwarded,
        xpAwarded,
        aiConfidence: extraction.confidence,
      },
    });

    return {
      ok: true,
      data: {
        receiptId: receipt.id,
        visitId: visit.id,
        amountIls: receipt.amountIls,
        currency: receipt.currency,
        receiptDatedAt: receipt.receiptDatedAt,
        coinsAwarded,
        xpAwarded,
        brandMonth: xpResult?.brandMonth ?? null,
        merchant: visit.merchant,
        imageUrl: receipt.imageUrl,
        status: receipt.status,
      },
    };
  } catch (err) {
    if (err?.code === "P2002") {
      return {
        ok: false,
        status: 409,
        msg: "Duplicate receipt submission",
      };
    }
    throw err;
  }
};

import { prisma } from "../../config/db.js";
import {
  SilentDropMerchantCreateSchema,
  SilentDropMerchantUpdateSchema,
} from "../../schema/SilentDrop.js";
import {
  createSilentDropRecord,
  resolveSilentDropStatus,
} from "../../utils/liveEventSilentDrop.js";
import { LIVE_EVENT_DISPLAY } from "../../utils/liveEventModes.js";
import { generateB2bZoneImages } from "../../utils/GeminiAi.js";

export const merchantListSilentDrops = async (req, res) => {
  const merchantId = req.merchant.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  try {
    const where = {
      merchantId,
      displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
    };
    const [items, total] = await Promise.all([
      prisma.liveEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.liveEvent.count({ where }),
    ]);

    return res.status(200).json({
      status: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const merchantCreateSilentDrop = async (req, res) => {
  const merchantId = req.merchant.id;
  const { error, value } = SilentDropMerchantCreateSchema(req.body, merchantId);
  if (error) {
    const detail = error.details?.map((d) => d.message).join("; ") || error.message;
    return res.status(400).json({ status: false, msg: detail });
  }

  try {
    const event = await createSilentDropRecord({
      ...value,
      merchantId,
      skipCredits: false,
    });

    return res.status(201).json({
      status: true,
      msg: "Silent drop created and will appear on the Single Player map when live",
      data: event,
    });
  } catch (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }
};

export const merchantUpdateSilentDrop = async (req, res) => {
  const merchantId = req.merchant.id;
  const { id } = req.params;
  const { error, value } = SilentDropMerchantUpdateSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const existing = await prisma.liveEvent.findFirst({
      where: {
        id,
        merchantId,
        displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
      },
    });
    if (!existing) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }
    if (existing.status === "live") {
      return res.status(400).json({
        status: false,
        msg: "Cannot edit a live silent drop. Cancel it first or wait until it ends.",
      });
    }

    const data = { ...value };
    if (value.rewardQuantity != null) {
      const delta = value.rewardQuantity - existing.rewardQuantity;
      data.remainingQty = Math.max(0, existing.remainingQty + delta);
    }
    if (value.startTime && !value.status) {
      data.status = resolveSilentDropStatus(value.startTime);
    }

    const updated = await prisma.liveEvent.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      status: true,
      msg: "Silent drop updated",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const merchantGenerateSilentDropImages = async (req, res) => {
  const { zoneName, rewardTitle, includeRewardImage } = req.body;
  if (!zoneName || typeof zoneName !== "string") {
    return res.status(400).json({ status: false, msg: "zoneName is required" });
  }
  try {
    const images = await generateB2bZoneImages({
      zoneName,
      rewardTitle,
      includeRewardImage: includeRewardImage !== false,
    });
    return res.status(200).json({
      status: true,
      msg: "Images generated",
      data: images,
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const merchantDeleteSilentDrop = async (req, res) => {
  const merchantId = req.merchant.id;
  const { id } = req.params;

  try {
    const existing = await prisma.liveEvent.findFirst({
      where: {
        id,
        merchantId,
        displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
      },
    });
    if (!existing) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }

    await prisma.liveEvent.update({
      where: { id },
      data: { status: "cancelled", remainingQty: 0 },
    });

    return res.status(200).json({
      status: true,
      msg: "Silent drop cancelled",
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

export const merchantGetSilentDrop = async (req, res) => {
  const merchantId = req.merchant.id;
  const { id } = req.params;

  try {
    const event = await prisma.liveEvent.findFirst({
      where: {
        id,
        merchantId,
        displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP,
      },
      include: {
        claims: {
          orderBy: { claimedAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, photoUrl: true } },
          },
        },
      },
    });
    if (!event) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }
    return res.status(200).json({
      status: true,
      data: event,
    });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

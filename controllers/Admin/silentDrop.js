import { prisma } from "../../config/db.js";
import {
  SilentDropCreateSchema,
  SilentDropUpdateSchema,
} from "../../schema/SilentDrop.js";
import {
  createSilentDropRecord,
  listSilentDropsForAdmin,
  resolveSilentDropStatus,
} from "../../utils/liveEventSilentDrop.js";
import { LIVE_EVENT_DISPLAY } from "../../utils/liveEventModes.js";
import { generateB2bZoneImages } from "../../utils/GeminiAi.js";

export const adminListSilentDrops = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const merchantId = req.query.merchantId;

  try {
    const { items, total } = await listSilentDropsForAdmin({
      page,
      limit,
      merchantId,
    });
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

export const adminCreateSilentDrop = async (req, res) => {
  const { error, value } = SilentDropCreateSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  if (!value.merchantId) {
    return res.status(400).json({
      status: false,
      msg: "merchantId is required for admin-created silent drops",
    });
  }

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: value.merchantId },
    });
    if (!merchant) {
      return res.status(404).json({ status: false, msg: "Merchant not found" });
    }

    const event = await createSilentDropRecord({
      ...value,
      skipCredits: true,
    });

    return res.status(201).json({
      status: true,
      msg: "Silent drop created",
      data: event,
    });
  } catch (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }
};

export const adminUpdateSilentDrop = async (req, res) => {
  const { id } = req.params;
  const { error, value } = SilentDropUpdateSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const existing = await prisma.liveEvent.findUnique({ where: { id } });
    if (!existing || existing.displayMode !== LIVE_EVENT_DISPLAY.SILENT_MAP_DROP) {
      return res.status(404).json({ status: false, msg: "Silent drop not found" });
    }
    const data = { ...value };
    if (value.rewardQuantity != null) {
      const delta = value.rewardQuantity - existing.rewardQuantity;
      data.remainingQty = Math.max(0, existing.remainingQty + delta);
      data.rewardQuantity = value.rewardQuantity;
    }
    if (value.startTime) {
      data.status =
        value.status ??
        resolveSilentDropStatus(value.startTime);
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

export const adminDeleteSilentDrop = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.liveEvent.findUnique({ where: { id } });
    if (!existing || existing.displayMode !== LIVE_EVENT_DISPLAY.SILENT_MAP_DROP) {
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

export const adminGenerateSilentDropImages = async (req, res) => {
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

export const adminGetSilentDrop = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await prisma.liveEvent.findFirst({
      where: { id, displayMode: LIVE_EVENT_DISPLAY.SILENT_MAP_DROP },
      include: {
        merchant: { select: { id: true, name: true, businessName: true } },
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
    return res.status(200).json({ status: true, data: event });
  } catch (error) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

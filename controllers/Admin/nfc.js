import { prisma } from "../../config/db.js";
import { CreateNfcTagSchema } from "../../schema/nfc.js";
import {
  createMerchantNfcTag,
  ensureDefaultMerchantNfcTag,
  listMerchantNfcTags,
  listNfcVisits,
} from "../../utils/nfc/visitService.js";
import { formatTagForClient } from "../../utils/nfc/payload.js";

const assertMerchant = async (merchantId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true, businessName: true, status: true },
  });
  return merchant;
};

/**
 * @Route GET /api/admin/nfc/merchants/:merchantId/tags
 */
export const adminListMerchantNfcTags = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await assertMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ status: false, msg: "Merchant not found" });
    }

    // Auto-provision so admin always has something to print/program
    await ensureDefaultMerchantNfcTag(merchantId);
    const tags = await listMerchantNfcTags(merchantId);

    return res.status(200).json({
      status: true,
      merchant,
      data: tags,
    });
  } catch (err) {
    return res.status(500).json({ status: false, msg: err.message });
  }
};

/**
 * @Route POST /api/admin/nfc/merchants/:merchantId/tags
 */
export const adminCreateMerchantNfcTag = async (req, res) => {
  const { error, value } = CreateNfcTagSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const { merchantId } = req.params;
    const merchant = await assertMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ status: false, msg: "Merchant not found" });
    }

    const tag = await createMerchantNfcTag(merchantId, {
      label: value.label || "Counter",
      chipUid: value.chipUid || null,
    });

    return res.status(201).json({
      status: true,
      msg: "NFC tag created",
      data: formatTagForClient(tag),
    });
  } catch (err) {
    return res.status(500).json({ status: false, msg: err.message });
  }
};

/**
 * @Route GET /api/admin/nfc/merchants/:merchantId/visits
 */
export const adminListMerchantNfcVisits = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await assertMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ status: false, msg: "Merchant not found" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await listNfcVisits({ merchantId, page, limit });

    return res.status(200).json({
      status: true,
      merchant,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(500).json({ status: false, msg: err.message });
  }
};

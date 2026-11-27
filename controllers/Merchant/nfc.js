import { CreateNfcTagSchema } from "../../schema/nfc.js";
import {
  createMerchantNfcTag,
  ensureDefaultMerchantNfcTag,
  listMerchantNfcTags,
  listNfcVisits,
} from "../../utils/nfc/visitService.js";
import { formatTagForClient } from "../../utils/nfc/payload.js";

/**
 * @Route GET /api/merchant/nfc/tags
 */
export const merchantListNfcTags = async (req, res) => {
  try {
    const merchantId = req.merchant.id;
    await ensureDefaultMerchantNfcTag(merchantId);
    const tags = await listMerchantNfcTags(merchantId);
    return res.status(200).json({ status: true, data: tags });
  } catch (err) {
    return res.status(500).json({ status: false, msg: err.message });
  }
};

/**
 * @Route POST /api/merchant/nfc/tags
 */
export const merchantCreateNfcTag = async (req, res) => {
  const { error, value } = CreateNfcTagSchema(req.body);
  if (error) {
    return res.status(400).json({ status: false, msg: error.message });
  }

  try {
    const tag = await createMerchantNfcTag(req.merchant.id, {
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
 * @Route GET /api/merchant/nfc/visits
 */
export const merchantListNfcVisits = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await listNfcVisits({
      merchantId: req.merchant.id,
      page,
      limit,
    });
    return res.status(200).json({
      status: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(500).json({ status: false, msg: err.message });
  }
};

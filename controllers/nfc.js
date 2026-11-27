import { NfcReceiptSubmitSchema, NfcVerifySchema } from "../schema/nfc.js";
import { verifyNfcVisit, listNfcVisits } from "../utils/nfc/visitService.js";
import { submitNfcReceipt } from "../utils/nfc/receiptService.js";

/**
 * @Description Verify NFC tap at a partner business (visit mission)
 * @Route POST /api/nfc/verify
 * @Access Private (User)
 */
export const verifyNfcTap = async (req, res) => {
  const { error, value } = NfcVerifySchema(req.body);
  if (error) {
    return res.status(400).json({
      status: false,
      msg: error.details?.map((d) => d.message).join("; ") || error.message,
    });
  }

  try {
    const result = await verifyNfcVisit({
      userId: req.user.id,
      payload: value.payload ?? value.uri ?? value.nfcPayload ?? value.token,
      latitude: value.latitude ?? value.lat ?? null,
      longitude: value.longitude ?? value.lng ?? null,
      chipUid: value.chipUid || null,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        status: false,
        msg: result.msg,
      });
    }

    return res.status(200).json({
      status: true,
      msg: result.data.missionCompleted
        ? "Visit verified — mission complete"
        : "Visit logged (already rewarded today)",
      data: result.data,
    });
  } catch (err) {
    console.error("[NFC verify]", err);
    return res.status(500).json({ status: false, msg: err.message });
  }
};

/**
 * @Description Player's own NFC visit history
 * @Route GET /api/nfc/my-visits
 */
export const getMyNfcVisits = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await listNfcVisits({
      userId: req.user.id,
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

/**
 * @Description Submit live-camera receipt photo for bonus coins (Phase 2)
 * @Route POST /api/nfc/receipt
 * @Access Private (User)
 * multipart: image (optional) + visitId + captureSource=camera
 * OR json/form: visitId + imageUrl + captureSource=camera
 */
export const submitNfcReceiptPhoto = async (req, res) => {
  const body = {
    visitId: req.body?.visitId,
    imageUrl: req.body?.imageUrl,
    captureSource: req.body?.captureSource,
  };
  const { error, value } = NfcReceiptSubmitSchema(body);
  if (error) {
    return res.status(400).json({
      status: false,
      msg: error.details?.map((d) => d.message).join("; ") || error.message,
    });
  }

  if (!req.file && !value.imageUrl) {
    return res.status(400).json({
      status: false,
      msg: "Provide multipart field `image` or `imageUrl`",
    });
  }

  try {
    const result = await submitNfcReceipt({
      userId: req.user.id,
      visitId: value.visitId,
      imageUrl: value.imageUrl || null,
      imageBuffer: req.file?.buffer || null,
      imageMimeType: req.file?.mimetype || null,
      originalName: req.file?.originalname || "receipt.jpg",
      captureSource: value.captureSource,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        status: false,
        msg: result.msg,
        ...(result.data ? { data: result.data } : {}),
      });
    }

    return res.status(200).json({
      status: true,
      msg: `Receipt approved — ₪${result.data.amountIls} → +${result.data.coinsAwarded} coins`,
      data: result.data,
    });
  } catch (err) {
    console.error("[NFC receipt]", err);
    return res.status(500).json({ status: false, msg: err.message });
  }
};

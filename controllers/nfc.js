import { NfcVerifySchema } from "../schema/nfc.js";
import { verifyNfcVisit, listNfcVisits } from "../utils/nfc/visitService.js";

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

import { generateB2bCampaignDraft } from "../../utils/GeminiAi.js";

/**
 * @Description AI text-to-campaign draft for B2B raid zone (not published)
 * @Route POST /api/merchant/single-player/b2b-zones/ai-draft
 * @Access Private (Merchant)
 */
export const merchantB2bAiDraft = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ status: false, msg: "prompt is required" });
  }

  try {
    const draft = await generateB2bCampaignDraft(prompt);
    res.status(200).json({
      status: true,
      msg: "Draft generated — review and submit via POST /b2b-zones",
      data: { draft, isPublished: false },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

import { generateB2bCampaignDraft } from "../../utils/GeminiAi.js";

/**
 * @Description AI text-to-campaign draft for B2B raid zone (admin review)
 * @Route POST /api/admin/single-player/b2b/ai-draft
 * @Access Private (Admin)
 */
export const adminB2bAiDraft = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ status: false, msg: "prompt is required" });
  }

  try {
    const draft = await generateB2bCampaignDraft(prompt);
    res.status(200).json({
      status: true,
      msg: "Draft generated — not live until merchant submit + approval flow",
      data: { draft, isPublished: false },
    });
  } catch (error) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

import { GoogleGenAI } from "@google/genai";

/**
 * Generates the three required images for a SponsoredTheme using Gemini (Imagen 3).
 * @param {string} themeName - The name of the theme (e.g., "McDonalds")
 * @returns {Promise<{dropImageBase64: string, zoneImageBase64: string, mapLogoBase64: string}>}
 */
export const generateThemeImages = async (themeName) => {
  if (!themeName) {
    throw new Error("Theme name is required");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GEMINI_KEY is missing in .env");
  }

  // Initialize the SDK with the explicitly provided key
  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log(`Generating images for theme: ${themeName}...`);

    const dropImagePrompt = `A high-quality 3D rendered square gift box tied with a ribbon and bow, themed around "${themeName}". The gift box should incorporate the brand colors, logos, and aesthetics of "${themeName}" directly on the box. It should look like a premium gift. Glossy finish, vibrant colors, perfectly isolated on a completely transparent background with no background elements.`;
    
    const zoneImagePrompt = `A neon glowing 3D shield icon featuring a castle or tower symbol in the center. The shield and its glow should be heavily themed with the brand colors and style of "${themeName}". High tech, sci-fi, or fantasy vibe, high quality 3D render, perfectly isolated on a completely transparent background with no background elements.`;
    
    const mapLogoPrompt = `A glossy, high-quality 3D map pin (location marker) icon. In the center of the map pin, clearly display the logo or iconic symbol of "${themeName}". The map pin itself should use the main brand colors of "${themeName}". 3D rendered, perfectly isolated on a completely transparent background with no background elements.`;

    // Google recently updated the image generation model name to "gemini-3.1-flash-image"
    // and requires usage of the generateContent method.
    const modelName = "gemini-3.1-flash-image"; 

    const [dropImgRes, zoneImgRes, mapLogoRes] = await Promise.all([
      ai.models.generateContent({
        model: modelName,
        contents: dropImagePrompt,
        config: { outputMimeType: "image/png" }
      }),
      ai.models.generateContent({
        model: modelName,
        contents: zoneImagePrompt,
        config: { outputMimeType: "image/png" }
      }),
      ai.models.generateContent({
        model: modelName,
        contents: mapLogoPrompt,
        config: { outputMimeType: "image/png" }
      })
    ]);

    const extractBase64 = (res) => {
      const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part ? part.inlineData.data : null;
    };

    const dropImageBase64 = extractBase64(dropImgRes);
    const zoneImageBase64 = extractBase64(zoneImgRes);
    const mapLogoBase64 = extractBase64(mapLogoRes);

    if (!dropImageBase64 || !zoneImageBase64 || !mapLogoBase64) {
      throw new Error("Failed to extract image bytes from response.");
    }

    return {
      dropImageBase64,
      zoneImageBase64,
      mapLogoBase64
    };

  } catch (error) {
    console.error("Error generating theme images:", error);
    throw new Error(error.message || "Failed to generate theme images using Gemini API.");
  }
};

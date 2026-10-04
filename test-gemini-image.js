import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY });

async function run() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: "A red box",
      config: {
        outputMimeType: "image/jpeg"
      }
    });
    
    // Find inline data
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part) {
      console.log("Success! Bytes length:", part.inlineData.data.length);
    } else {
      console.log("No inlineData returned:", JSON.stringify(res, null, 2));
    }
  } catch (e) {
    console.error("Failed:", e.message);
  }
}
run();

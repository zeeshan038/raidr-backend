import { GoogleGenAI } from "@google/genai";
import { NFC_RECEIPT_VISION_MODEL } from "./constants.js";

const EXTRACTION_PROMPT = `You are a receipt OCR assistant for RAIDR (Israel).
Extract ONLY the final payable total and the receipt date/time from this photo.

Rules:
- Prefer the grand total / amount due (not subtotal, tax-only, or change).
- Amount must be a number in the receipt currency (usually ILS / ₪).
- Date/time: use the printed receipt date. If only a date exists, use noon local.
- If this is NOT a purchase receipt (screenshot, random photo, blank), set isReceipt=false.
- Reply with JSON only, no markdown.

JSON shape:
{
  "isReceipt": true,
  "amount": 42.50,
  "currency": "ILS",
  "receiptDate": "2026-11-23",
  "receiptTime": "14:35",
  "confidence": 0.0,
  "reason": "short note"
}`;

const parseJsonLoose = (text) => {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const normalizeExtraction = (raw) => {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: "AI returned no usable receipt data",
    };
  }

  const isReceipt = Boolean(raw.isReceipt);
  if (!isReceipt) {
    return {
      ok: false,
      error: raw.reason || "Image does not look like a purchase receipt",
    };
  }

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Could not read a valid purchase total from the receipt" };
  }

  const dateStr = String(raw.receiptDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Could not read receipt date" };
  }

  let timeStr = String(raw.receiptTime || "12:00").trim();
  if (!/^\d{1,2}:\d{2}/.test(timeStr)) {
    timeStr = "12:00";
  }
  const [hh, mm] = timeStr.split(":");
  const hour = Math.min(23, Math.max(0, parseInt(hh, 10) || 12));
  const minute = Math.min(59, Math.max(0, parseInt(mm, 10) || 0));

  // Interpret as Asia/Jerusalem wall clock → UTC Date via offset approximation
  // Using ISO with explicit +02/+03 is fragile; store as Date from Y-M-D T H:M as UTC
  // and validate day key in Jerusalem separately in receiptService.
  const receiptDatedAt = new Date(
    Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10)),
      hour,
      minute,
      0
    )
  );

  return {
    ok: true,
    amountIls: Math.round(amount * 100) / 100,
    currency: String(raw.currency || "ILS").toUpperCase().slice(0, 8),
    receiptDateKey: dateStr,
    receiptDatedAt,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.min(1, Math.max(0, raw.confidence))
        : null,
    reason: raw.reason || null,
  };
};

async function extractWithGemini({ buffer, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY / GEMINI_KEY missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64 = buffer.toString("base64");
  const res = await ai.models.generateContent({
    model: NFC_RECEIPT_VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const text =
    res?.text ||
    res?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ||
    "";
  return normalizeExtraction(parseJsonLoose(text));
}

async function extractWithOpenAI({ buffer, mimeType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${buffer.toString("base64")}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "OpenAI vision error");
  }
  const text = data.choices?.[0]?.message?.content || "";
  return normalizeExtraction(parseJsonLoose(text));
}

/**
 * Extract purchase total + date from a receipt image buffer.
 * Prefers Gemini Vision; falls back to OpenAI gpt-4o.
 */
export async function extractReceiptFromImage({ buffer, mimeType }) {
  if (!buffer?.length) {
    return { ok: false, error: "Empty receipt image" };
  }

  let lastError = null;
  try {
    const gemini = await extractWithGemini({ buffer, mimeType });
    if (gemini.ok) return { ...gemini, provider: "gemini" };
    lastError = gemini.error;
    // Non-receipt / bad parse from Gemini — still try OpenAI once
  } catch (err) {
    lastError = err.message;
    console.warn("[NFC receipt] Gemini vision failed:", err.message);
  }

  try {
    const openai = await extractWithOpenAI({ buffer, mimeType });
    if (openai.ok) return { ...openai, provider: "openai" };
    return { ok: false, error: openai.error || lastError || "Receipt extraction failed" };
  } catch (err) {
    console.warn("[NFC receipt] OpenAI vision failed:", err.message);
    return {
      ok: false,
      error: lastError || err.message || "Receipt extraction failed",
    };
  }
}

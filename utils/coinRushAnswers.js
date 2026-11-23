/**
 * Normalize Q&A answer fields for create/update.
 * Keeps `answer` as primary (defaults to en) and optional `answerLocales` map.
 */
export const normalizeAnswerLocales = ({ answer, answerLocales } = {}) => {
  const locales = {};
  if (answerLocales && typeof answerLocales === "object" && !Array.isArray(answerLocales)) {
    for (const [key, value] of Object.entries(answerLocales)) {
      const lang = String(key || "")
        .trim()
        .toLowerCase();
      const text = value == null ? "" : String(value).trim();
      if (lang && text) {
        locales[lang] = text;
      }
    }
  }

  let primary = answer == null ? "" : String(answer).trim();
  if (!primary && locales.en) {
    primary = locales.en;
  }
  if (!primary) {
    primary = Object.values(locales)[0] || "";
  }
  if (primary && !locales.en) {
    locales.en = primary;
  }

  return {
    answer: primary || null,
    answerLocales: Object.keys(locales).length ? locales : null,
  };
};

const normalizeAnswerText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** True if submitted answer matches primary or any localized accepted answer. */
export const answersMatch = (submitted, checkpoint) => {
  const needle = normalizeAnswerText(submitted);
  if (!needle) return false;

  const candidates = [];
  if (checkpoint?.answer) {
    candidates.push(checkpoint.answer);
  }
  const locales = checkpoint?.answerLocales;
  if (locales && typeof locales === "object") {
    for (const value of Object.values(locales)) {
      if (value) candidates.push(value);
    }
  }

  return candidates.some((c) => normalizeAnswerText(c) === needle);
};

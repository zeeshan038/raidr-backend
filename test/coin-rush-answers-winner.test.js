import assert from "node:assert/strict";
import test from "node:test";

import {
  answersMatch,
  normalizeAnswerLocales,
} from "../utils/coinRushAnswers.js";

test("normalizeAnswerLocales fills en from primary answer", () => {
  const result = normalizeAnswerLocales({ answer: "Coffee" });
  assert.equal(result.answer, "Coffee");
  assert.deepEqual(result.answerLocales, { en: "Coffee" });
});

test("normalizeAnswerLocales uses en when answer missing", () => {
  const result = normalizeAnswerLocales({
    answerLocales: { en: "tea", he: "תה" },
  });
  assert.equal(result.answer, "tea");
  assert.equal(result.answerLocales.he, "תה");
});

test("answersMatch accepts any localized answer", () => {
  const checkpoint = {
    answer: "coffee",
    answerLocales: { en: "coffee", he: "קפה", ar: "قهوة" },
  };
  assert.equal(answersMatch("coffee", checkpoint), true);
  assert.equal(answersMatch("קפה", checkpoint), true);
  assert.equal(answersMatch("قهوة", checkpoint), true);
  assert.equal(answersMatch("  Coffee  ", checkpoint), true);
  assert.equal(answersMatch("wrong", checkpoint), false);
});

test("answersMatch works with primary answer only", () => {
  assert.equal(answersMatch("yes", { answer: "Yes" }), true);
  assert.equal(answersMatch("no", { answer: "Yes" }), false);
});

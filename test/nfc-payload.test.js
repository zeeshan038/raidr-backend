import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNfcPayloadUri,
  parseNfcPayload,
} from "../utils/nfc/payload.js";

test("buildNfcPayloadUri includes token and optional merchantId", () => {
  const uri = buildNfcPayloadUri({
    token: "tok_abc",
    merchantId: "11111111-1111-1111-1111-111111111111",
  });
  assert.match(uri, /^raidr:\/\/nfc\/v1\?/);
  assert.match(uri, /token=tok_abc/);
  assert.match(uri, /merchantId=11111111-1111-1111-1111-111111111111/);
});

test("parseNfcPayload accepts full URI", () => {
  const parsed = parseNfcPayload(
    "raidr://nfc/v1?token=abc12345&merchantId=m1"
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.token, "abc12345");
  assert.equal(parsed.merchantId, "m1");
});

test("parseNfcPayload accepts bare token", () => {
  const parsed = parseNfcPayload("plainTokenValue99");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.token, "plainTokenValue99");
});

test("parseNfcPayload accepts { payload } object", () => {
  const parsed = parseNfcPayload({
    payload: "raidr://nfc/v1?token=fromObj",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.token, "fromObj");
});

test("parseNfcPayload rejects empty", () => {
  assert.equal(parseNfcPayload(null).ok, false);
  assert.equal(parseNfcPayload({}).ok, false);
});

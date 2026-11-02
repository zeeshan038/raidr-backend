import assert from "node:assert/strict";
import {
  normalizeInviteCodeInput,
  buildInviteShareUrl,
} from "../utils/referralService.js";

assert.equal(normalizeInviteCodeInput("  ab7x9k  "), "AB7X9K");
assert.equal(
  normalizeInviteCodeInput("https://raidr.app/invite/ab7x9k"),
  "AB7X9K"
);
assert.equal(normalizeInviteCodeInput(""), null);
assert.equal(normalizeInviteCodeInput(null), null);

const prev = process.env.RAIDR_INVITE_BASE_URL;
process.env.RAIDR_INVITE_BASE_URL = "https://raidr.app/invite/";
assert.equal(buildInviteShareUrl("AB7X9K"), "https://raidr.app/invite/AB7X9K");
if (prev === undefined) {
  delete process.env.RAIDR_INVITE_BASE_URL;
} else {
  process.env.RAIDR_INVITE_BASE_URL = prev;
}

console.log("referralService unit checks passed");

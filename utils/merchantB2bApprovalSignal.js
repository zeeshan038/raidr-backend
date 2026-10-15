import { redis } from "../config/redis.js";

const versionKey = (merchantId) => `merchant:${merchantId}:b2b:approval:version`;
const lastKey = (merchantId) => `merchant:${merchantId}:b2b:approval:last`;

export const bumpMerchantB2bApprovalSignal = async ({
  merchantId,
  zoneId,
  zoneName,
  status,
}) => {
  if (!merchantId) return null;
  try {
    const version = await redis.incr(versionKey(merchantId));
    await redis.set(
      lastKey(merchantId),
      JSON.stringify({
        version,
        zoneId,
        zoneName,
        status,
        at: new Date().toISOString(),
      })
    );
    return version;
  } catch (err) {
    console.warn("[merchantB2bApprovalSignal]", err.message);
    return null;
  }
};

export const getMerchantB2bApprovalSignal = async (merchantId) => {
  if (!merchantId) {
    return { version: 0, last: null };
  }
  try {
    const [version, lastRaw] = await Promise.all([
      redis.get(versionKey(merchantId)),
      redis.get(lastKey(merchantId)),
    ]);
    let last = null;
    if (lastRaw) {
      try {
        last = JSON.parse(lastRaw);
      } catch {
        last = null;
      }
    }
    return {
      version: version ? Number(version) : 0,
      last,
    };
  } catch {
    return { version: 0, last: null };
  }
};

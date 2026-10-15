import { redis } from "../config/redis.js";

const ADMIN_B2B_PENDING_VERSION_KEY = "admin:b2b:pending:version";

/**
 * Bumps a Redis counter when a merchant submits a B2B zone for approval.
 * Super Admin UI polls pending list + this version for faster notification UX.
 */
export const bumpAdminB2bPendingSignal = async ({ zoneId, zoneName }) => {
  try {
    const version = await redis.incr(ADMIN_B2B_PENDING_VERSION_KEY);
    await redis.set(
      "admin:b2b:pending:last",
      JSON.stringify({
        version,
        zoneId,
        zoneName,
        at: new Date().toISOString(),
      })
    );
    return version;
  } catch (err) {
    console.warn("[adminB2bPendingSignal]", err.message);
    return null;
  }
};

export const getAdminB2bPendingSignal = async () => {
  try {
    const [version, lastRaw] = await Promise.all([
      redis.get(ADMIN_B2B_PENDING_VERSION_KEY),
      redis.get("admin:b2b:pending:last"),
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

/** Cached: whether this DB has Single Player map tables (minimal/referral-only DBs do not). */
let singlePlayerZoneTableReady = null;
let skipLogged = false;

export const isSinglePlayerZoneTableReady = async (prisma) => {
  if (singlePlayerZoneTableReady === true) return true;
  if (singlePlayerZoneTableReady === false) return false;

  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'SinglePlayerZone'
      LIMIT 1
    `;
    singlePlayerZoneTableReady = Array.isArray(rows) && rows.length > 0;
  } catch {
    singlePlayerZoneTableReady = false;
  }
  return singlePlayerZoneTableReady;
};

/** Call once when skipping SP crons so logs are not spammed every interval. */
export const logSinglePlayerCronSkippedOnce = (jobName) => {
  if (skipLogged) return;
  skipLogged = true;
  console.log(
    `[Cron] ${jobName}: skipped — Single Player tables missing on this database (referral-only local DB is OK).`
  );
};

/** Any missing Prisma table (P2021) for Single Player / economy config. */
export const isSinglePlayerSchemaError = (err) =>
  err?.code === "P2021" &&
  (err?.meta?.modelName === "SinglePlayerZone" ||
    err?.meta?.modelName === "SinglePlayerGameConfig");

export const handleSinglePlayerSchemaError = (err, jobName) => {
  if (!isSinglePlayerSchemaError(err)) return false;
  markSinglePlayerZoneTableMissing();
  logSinglePlayerCronSkippedOnce(jobName);
  return true;
};

export const markSinglePlayerZoneTableMissing = () => {
  singlePlayerZoneTableReady = false;
};

export const clearSinglePlayerSchemaReadyCache = () => {
  singlePlayerZoneTableReady = null;
  skipLogged = false;
};

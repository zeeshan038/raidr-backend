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
    `[Cron] ${jobName}: skipped — SinglePlayerZone table not in this database (referral/coin-rush-only DB is OK).`
  );
};

export const markSinglePlayerZoneTableMissing = () => {
  singlePlayerZoneTableReady = false;
};

export const clearSinglePlayerSchemaReadyCache = () => {
  singlePlayerZoneTableReady = null;
  skipLogged = false;
};

/** GPS completion radius for Coin Rush checkpoints (must match client geofence). */
export const COIN_RUSH_CHECKPOINT_GPS_RADIUS_METERS = 20;

export function sanitizeCoinRushCheckpointForClient(checkpoint, isAchieved = false) {
    const safeCp = { ...checkpoint, isAchieved };
    delete safeCp.qrCode;
    delete safeCp.answer;
    delete safeCp.secretCode;

    const instruction = checkpoint.description || '';
    safeCp.hint = instruction;
    safeCp.instruction = instruction;

    return safeCp;
}

/**
 * GET /events/details/:eventId (coin rush) — full checkpoint list for progress UI.
 * Matches pre-change behavior: hide qrCode only; do not slice future checkpoints.
 */
export function buildCoinRushCheckpointsForEventDetails(checkpoints, completedCheckpointIds) {
    const completedCount = completedCheckpointIds.length;
    const safeCheckpoints = checkpoints.map((cp) => {
        const { qrCode, ...rest } = cp;
        const instruction = cp.description || '';
        return {
            ...rest,
            isAchieved: completedCheckpointIds.includes(cp.id),
            hint: instruction,
            instruction,
        };
    });

    const upcomingCheckpoint =
        completedCount < checkpoints.length ? safeCheckpoints[completedCount] : null;

    return {
        safeCheckpoints,
        upcomingCheckpoint,
        checkpointRadiusMeters: COIN_RUSH_CHECKPOINT_GPS_RADIUS_METERS,
        completedCount,
    };
}

/**
 * GET /coin-rush/details/:eventId — hide future checkpoints (progress + 1 only).
 * @param {Array} checkpoints - ordered by sequence asc
 * @param {string[]} completedCheckpointIds
 */
export function buildCoinRushCheckpointsPayload(checkpoints, completedCheckpointIds) {
    const completedCount = completedCheckpointIds.length;
    const visibleCheckpoints = checkpoints.slice(0, completedCount + 1);
    const safeCheckpoints = visibleCheckpoints.map((cp) =>
        sanitizeCoinRushCheckpointForClient(cp, completedCheckpointIds.includes(cp.id))
    );

    const upcomingCheckpoint =
        completedCount < checkpoints.length
            ? sanitizeCoinRushCheckpointForClient(checkpoints[completedCount], false)
            : null;

    return {
        safeCheckpoints,
        upcomingCheckpoint,
        checkpointRadiusMeters: COIN_RUSH_CHECKPOINT_GPS_RADIUS_METERS,
        completedCount,
    };
}

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

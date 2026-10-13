import { prisma } from '../config/db.js';

/**
 * @Description Phase 2: shield expiry no longer clears zone ownership (zones become attackable only).
 * Cron retained as a no-op hook for future shield-related maintenance.
 */
export const startResetZonesCron = () => {
    // Ownership persists after shieldExpiresAt; snatching changes owner.
};

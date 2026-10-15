/** XP needed to complete the current level and advance (matches trip/event/coinRush logic). */
export const xpRequiredForLevel = (level) => 100 * (level ?? 1) * (level ?? 1);

export const userLevelProgressFields = (user) => {
  const level = user?.level ?? 1;
  const xpProgress = user?.xp_progress ?? 0;
  const xpRequiredForNextLevel = xpRequiredForLevel(level);
  const levelProgressPercent =
    xpRequiredForNextLevel > 0
      ? Math.min(100, Math.round((xpProgress / xpRequiredForNextLevel) * 100))
      : 0;
  const xpRemainingForNextLevel = Math.max(0, xpRequiredForNextLevel - xpProgress);

  return {
    nextLevel: level + 1,
    levelProgressPercent,
    xpRequiredForNextLevel,
    xpRemainingForNextLevel,
  };
};

/** Strip secrets and internal fields from user rows returned to clients. */
export const sanitizeUserForClient = (user) => {
  const userResponse = { ...user, _id: user.id };
  delete userResponse.isNewUser;
  delete userResponse.password;
  delete userResponse.otpCode;
  delete userResponse.firebaseUid;
  delete userResponse.avatarUpdatedAt;
  delete userResponse.otpCreatedAt;
  delete userResponse.otpUpdatedAt;
  delete userResponse.otpCodeExpireTime;
  userResponse.preferences = Boolean(user.preferencesCompleted);
  delete userResponse.preferencesCompleted;
  return userResponse;
};

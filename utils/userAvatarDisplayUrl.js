/** Same default as User.avatarFrontUrl / store default avatar. */
export const DEFAULT_AVATAR_FRONT_URL =
  "https://hel1.your-objectstorage.com/raidr-assets/avatars/1_front.png";

const trimUrl = (value) => {
  const s = value == null ? "" : String(value).trim();
  return s.length > 0 ? s : "";
};

/**
 * Resolved front image for leaderboard / map (always non-empty).
 * Priority: equipped store item → user.avatarFrontUrl → photoUrl → default.
 */
export const resolveAvatarDisplayUrl = ({
  storeFrontUrl,
  avatarFrontUrl,
  photoUrl,
} = {}) =>
  trimUrl(storeFrontUrl) ||
  trimUrl(avatarFrontUrl) ||
  trimUrl(photoUrl) ||
  DEFAULT_AVATAR_FRONT_URL;

/**
 * Load Store + legacy Avatar (avatarNumber) maps for selectedAvatarId values.
 */
export const fetchAvatarFrontUrlMaps = async (prisma, selectedAvatarIds) => {
  const ids = [
    ...new Set(
      (selectedAvatarIds ?? [])
        .map((id) => (id == null ? "" : String(id).trim()))
        .filter((id) => id !== "" && id !== "424")
    ),
  ];

  const storeById = {};
  const avatarNumberByIdKey = {};

  const storeUuidIds = ids.filter((id) => !/^\d+$/.test(id));
  const numericIds = ids.filter((id) => /^\d+$/.test(id)).map((id) => parseInt(id, 10));

  if (storeUuidIds.length > 0) {
    try {
      const stores = await prisma.store.findMany({
        where: { id: { in: storeUuidIds } },
        select: { id: true, frontUrl: true },
      });
      for (const s of stores) {
        storeById[s.id] = s.frontUrl || "";
      }
    } catch (err) {
      if (err?.code !== "P2021") throw err;
    }
  }

  if (numericIds.length > 0) {
    try {
      const avatars = await prisma.avatar.findMany({
        where: { avatarNumber: { in: numericIds } },
        select: { avatarNumber: true, frontUrl: true },
      });
      for (const a of avatars) {
        avatarNumberByIdKey[String(a.avatarNumber)] = a.frontUrl || "";
      }
    } catch (err) {
      if (err?.code !== "P2021") throw err;
    }
  }

  return { storeById, avatarNumberByIdKey };
};

export const storeFrontUrlForSelectedAvatarId = (
  selectedAvatarId,
  { storeById, avatarNumberByIdKey }
) => {
  const id = trimUrl(selectedAvatarId);
  if (!id || id === "424") return "";
  if (storeById[id]) return storeById[id];
  if (/^\d+$/.test(id) && avatarNumberByIdKey[id]) return avatarNumberByIdKey[id];
  return "";
};

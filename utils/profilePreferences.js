export const PROFILE_OPTION_TYPE = {
  RAID_CITY: "RAID_CITY",
  INTEREST: "INTEREST",
  GENDER: "GENDER",
  AGE_RANGE: "AGE_RANGE",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isProfileOptionUuid = (value) =>
  typeof value === "string" && UUID_RE.test(value.trim());

/** Map UI labels or slugs to seed slug (e.g. "Male" → male, "25 - 34" → 25_34). */
export const normalizeProfileOptionSlug = (value) => {
  const s = String(value).trim().toLowerCase();
  if (!s) return s;
  if (isProfileOptionUuid(s)) return s;
  if (/^\d+\+$/.test(s)) return `${s.replace(/\+$/, "")}_plus`;
  return s
    .replace(/\+/g, "_plus")
    .replace(/\s*-\s*/g, "_")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

/** Resolve UUID or slug to ProfilePreferenceOption.id. */
export const resolveProfileOptionRef = async (prisma, type, ref) => {
  if (ref === undefined || ref === null || ref === "") {
    return { ok: true, id: undefined };
  }
  const raw = String(ref).trim();
  if (isProfileOptionUuid(raw)) {
    const row = await prisma.profilePreferenceOption.findFirst({
      where: { id: raw, type, isActive: true },
    });
    if (!row) {
      return { ok: false, msg: `Invalid ${type} option` };
    }
    return { ok: true, id: row.id };
  }
  const slug = normalizeProfileOptionSlug(raw);
  const row = await prisma.profilePreferenceOption.findFirst({
    where: { type, slug, isActive: true },
  });
  if (!row) {
    return { ok: false, msg: `Invalid ${type} option: ${raw}` };
  }
  return { ok: true, id: row.id };
};

const resolveProfileOptionRefList = async (prisma, type, refs) => {
  if (refs === undefined) {
    return { ok: true, ids: undefined };
  }
  if (!Array.isArray(refs)) {
    return { ok: false, msg: `${type} must be an array` };
  }
  const ids = [];
  for (const ref of refs) {
    const resolved = await resolveProfileOptionRef(prisma, type, ref);
    if (!resolved.ok) return resolved;
    if (resolved.id) ids.push(resolved.id);
  }
  return { ok: true, ids: [...new Set(ids)] };
};

/** Convert request body option fields (uuid or slug) to stored option ids. */
export const resolveProfilePreferencesOptions = async (prisma, body) => {
  const gender = await resolveProfileOptionRef(
    prisma,
    PROFILE_OPTION_TYPE.GENDER,
    body.genderOptionId
  );
  if (!gender.ok) return gender;

  const ageRange = await resolveProfileOptionRef(
    prisma,
    PROFILE_OPTION_TYPE.AGE_RANGE,
    body.ageRangeOptionId
  );
  if (!ageRange.ok) return ageRange;

  const raidCities = await resolveProfileOptionRefList(
    prisma,
    PROFILE_OPTION_TYPE.RAID_CITY,
    body.raidCityOptionIds
  );
  if (!raidCities.ok) return raidCities;

  const interests = await resolveProfileOptionRefList(
    prisma,
    PROFILE_OPTION_TYPE.INTEREST,
    body.interestOptionIds
  );
  if (!interests.ok) return interests;

  return {
    ok: true,
    genderOptionId: gender.id,
    ageRangeOptionId: ageRange.id,
    raidCityOptionIds: raidCities.ids,
    interestOptionIds: interests.ids,
  };
};

export const formatProfilePreferenceOption = (row) => ({
  id: row.id,
  type: row.type,
  label: row.label,
  subtitle: row.subtitle,
  iconKey: row.iconKey,
  accentColor: row.accentColor,
  slug: row.slug,
  sortOrder: row.sortOrder,
});

export const loadGroupedProfileOptions = async (prisma) => {
  const rows = await prisma.profilePreferenceOption.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });

  const grouped = {
    raidCities: [],
    interests: [],
    genders: [],
    ageRanges: [],
  };

  for (const row of rows) {
    const item = formatProfilePreferenceOption(row);
    switch (row.type) {
      case PROFILE_OPTION_TYPE.RAID_CITY:
        grouped.raidCities.push(item);
        break;
      case PROFILE_OPTION_TYPE.INTEREST:
        grouped.interests.push(item);
        break;
      case PROFILE_OPTION_TYPE.GENDER:
        grouped.genders.push(item);
        break;
      case PROFILE_OPTION_TYPE.AGE_RANGE:
        grouped.ageRanges.push(item);
        break;
      default:
        break;
    }
  }

  return grouped;
};

/** Ensure every id exists, is active, and matches the expected type(s). */
export const validateProfileOptionIds = async (
  prisma,
  { genderOptionId, ageRangeOptionId, raidCityOptionIds, interestOptionIds },
  { partial = false } = {}
) => {
  const checks = [
    {
      id: genderOptionId,
      type: PROFILE_OPTION_TYPE.GENDER,
      required: partial ? genderOptionId !== undefined : false,
    },
    {
      id: ageRangeOptionId,
      type: PROFILE_OPTION_TYPE.AGE_RANGE,
      required: partial ? ageRangeOptionId !== undefined : false,
    },
    {
      ids: raidCityOptionIds,
      type: PROFILE_OPTION_TYPE.RAID_CITY,
      required: partial ? raidCityOptionIds !== undefined : false,
      min: 1,
    },
    {
      ids: interestOptionIds,
      type: PROFILE_OPTION_TYPE.INTEREST,
      required: partial ? interestOptionIds !== undefined : false,
      min: 1,
    },
  ];

  for (const check of checks) {
    if (check.id) {
      const row = await prisma.profilePreferenceOption.findFirst({
        where: { id: check.id, type: check.type, isActive: true },
      });
      if (!row) {
        return { ok: false, msg: `Invalid ${check.type} option` };
      }
    } else if (check.ids) {
      const unique = [...new Set(check.ids ?? [])];
      if (check.required && unique.length < (check.min ?? 1)) {
        return { ok: false, msg: `At least one ${check.type} option is required` };
      }
      if (unique.length === 0) continue;
      const count = await prisma.profilePreferenceOption.count({
        where: { id: { in: unique }, type: check.type, isActive: true },
      });
      if (count !== unique.length) {
        return { ok: false, msg: `Invalid ${check.type} selection` };
      }
    } else if (check.required) {
      return { ok: false, msg: `${check.type} is required` };
    }
  }

  return { ok: true };
};

export const formatUserProfilePreferenceResponse = async (prisma, userId, pref) => {
  const allIds = [
    pref.genderOptionId,
    pref.ageRangeOptionId,
    ...(pref.raidCityOptionIds ?? []),
    ...(pref.interestOptionIds ?? []),
  ].filter(Boolean);

  const options = allIds.length
    ? await prisma.profilePreferenceOption.findMany({
        where: { id: { in: allIds } },
      })
    : [];
  const byId = new Map(options.map((o) => [o.id, formatProfilePreferenceOption(o)]));

  return {
    homeAddress: pref.homeAddress,
    homeCityLabel: pref.homeCityLabel,
    homeLatitude: pref.homeLatitude,
    homeLongitude: pref.homeLongitude,
    gender: pref.genderOptionId ? byId.get(pref.genderOptionId) ?? null : null,
    ageRange: pref.ageRangeOptionId ? byId.get(pref.ageRangeOptionId) ?? null : null,
    raidCities: (pref.raidCityOptionIds ?? [])
      .map((id) => byId.get(id))
      .filter(Boolean),
    interests: (pref.interestOptionIds ?? [])
      .map((id) => byId.get(id))
      .filter(Boolean),
  };
};

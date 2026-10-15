export const PROFILE_OPTION_TYPE = {
  RAID_CITY: "RAID_CITY",
  INTEREST: "INTEREST",
  GENDER: "GENDER",
  AGE_RANGE: "AGE_RANGE",
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
      required: partial ? genderOptionId !== undefined : true,
    },
    {
      id: ageRangeOptionId,
      type: PROFILE_OPTION_TYPE.AGE_RANGE,
      required: partial ? ageRangeOptionId !== undefined : true,
    },
    {
      ids: raidCityOptionIds,
      type: PROFILE_OPTION_TYPE.RAID_CITY,
      required: partial ? raidCityOptionIds !== undefined : true,
      min: 1,
    },
    {
      ids: interestOptionIds,
      type: PROFILE_OPTION_TYPE.INTEREST,
      required: partial ? interestOptionIds !== undefined : true,
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

import { prisma } from "../config/db.js";
import { PROFILE_OPTION_TYPE } from "../utils/profilePreferences.js";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SEED_ROWS = [
  {
    type: PROFILE_OPTION_TYPE.GENDER,
    label: "Male",
    slug: "male",
    iconKey: "male",
    sortOrder: 1,
  },
  {
    type: PROFILE_OPTION_TYPE.GENDER,
    label: "Female",
    slug: "female",
    iconKey: "female",
    sortOrder: 2,
  },
  {
    type: PROFILE_OPTION_TYPE.GENDER,
    label: "Other",
    slug: "other",
    iconKey: "other",
    sortOrder: 3,
  },
  {
    type: PROFILE_OPTION_TYPE.GENDER,
    label: "Prefer not to say",
    slug: "prefer_not_to_say",
    iconKey: "prefer_not",
    sortOrder: 4,
  },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "Under 18", slug: "under_18", sortOrder: 1 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "18 - 24", slug: "18_24", sortOrder: 2 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "25 - 34", slug: "25_34", sortOrder: 3 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "35 - 44", slug: "35_44", sortOrder: 4 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "45 - 54", slug: "45_54", sortOrder: 5 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "55 - 64", slug: "55_64", sortOrder: 6 },
  { type: PROFILE_OPTION_TYPE.AGE_RANGE, label: "65+", slug: "65_plus", sortOrder: 7 },
  { type: PROFILE_OPTION_TYPE.RAID_CITY, label: "Tel Aviv", slug: "tel_aviv", sortOrder: 1 },
  { type: PROFILE_OPTION_TYPE.RAID_CITY, label: "Jerusalem", slug: "jerusalem", sortOrder: 2 },
  { type: PROFILE_OPTION_TYPE.RAID_CITY, label: "Haifa", slug: "haifa", sortOrder: 3 },
  {
    type: PROFILE_OPTION_TYPE.RAID_CITY,
    label: "Rishon LeZion",
    slug: "rishon_lezion",
    sortOrder: 4,
  },
  { type: PROFILE_OPTION_TYPE.RAID_CITY, label: "Petah Tikva", slug: "petah_tikva", sortOrder: 5 },
  { type: PROFILE_OPTION_TYPE.RAID_CITY, label: "Netanya", slug: "netanya", sortOrder: 6 },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "All Categories",
    slug: "all_categories",
    iconKey: "all",
    accentColor: "#8B5CF6",
    sortOrder: 1,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Fashion",
    slug: "fashion",
    subtitle: "Clothes & Accessories",
    iconKey: "fashion",
    accentColor: "#3B82F6",
    sortOrder: 2,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Cosmetics",
    slug: "cosmetics",
    iconKey: "cosmetics",
    accentColor: "#EC4899",
    sortOrder: 3,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Sports Equipment",
    slug: "sports",
    iconKey: "sports",
    accentColor: "#34D399",
    sortOrder: 4,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Events",
    slug: "events",
    subtitle: "Concerts, Movies, Festivals & More",
    iconKey: "events",
    accentColor: "#F59E0B",
    sortOrder: 5,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Toys",
    slug: "toys",
    iconKey: "toys",
    accentColor: "#F472B6",
    sortOrder: 6,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Toddler Equipment",
    slug: "toddler",
    iconKey: "toddler",
    accentColor: "#A78BFA",
    sortOrder: 7,
  },
  {
    type: PROFILE_OPTION_TYPE.INTEREST,
    label: "Vacations",
    slug: "vacations",
    iconKey: "vacations",
    accentColor: "#38BDF8",
    sortOrder: 8,
  },
];

function ensureSchema() {
  execSync(
    "npx prisma db execute --file scripts/fix-profile-preferences-schema.sql --schema prisma/schema.prisma",
    { cwd: repoRoot, stdio: "inherit" }
  );
}

async function upsertOption(row) {
  const data = {
    label: row.label,
    subtitle: row.subtitle ?? null,
    iconKey: row.iconKey ?? null,
    accentColor: row.accentColor ?? null,
    sortOrder: row.sortOrder ?? 0,
    isActive: true,
  };

  return prisma.profilePreferenceOption.upsert({
    where: {
      type_slug: { type: row.type, slug: row.slug },
    },
    create: {
      type: row.type,
      slug: row.slug,
      ...data,
    },
    update: data,
  });
}

async function main() {
  console.log("==> Ensuring profile preference tables / User.preferencesCompleted...");
  ensureSchema();

  console.log("==> Seeding ProfilePreferenceOption rows...");
  let createdOrUpdated = 0;
  for (const row of SEED_ROWS) {
    await upsertOption(row);
    createdOrUpdated += 1;
  }

  const counts = await prisma.profilePreferenceOption.groupBy({
    by: ["type"],
    where: { isActive: true },
    _count: { _all: true },
  });

  console.log("==> Done. Active options by type:");
  for (const c of counts) {
    console.log(`    ${c.type}: ${c._count._all}`);
  }
  console.log(`    (processed ${createdOrUpdated} seed rows)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

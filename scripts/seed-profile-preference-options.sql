-- Default onboarding options (idempotent). Run after profile preferences migration.

INSERT INTO "ProfilePreferenceOption" ("id", "type", "label", "subtitle", "iconKey", "accentColor", "slug", "sortOrder", "isActive", "updatedAt")
SELECT gen_random_uuid()::text, 'GENDER', v.label, NULL, v.icon, NULL, v.slug, v.ord, true, NOW()
FROM (VALUES
  ('Male', 'male', 'male', 1),
  ('Female', 'female', 'female', 2),
  ('Other', 'other', 'other', 3),
  ('Prefer not to say', 'prefer_not', 'prefer_not_to_say', 4)
) AS v(label, icon, slug, ord)
WHERE NOT EXISTS (SELECT 1 FROM "ProfilePreferenceOption" o WHERE o."type" = 'GENDER' AND o."slug" = v.slug);

INSERT INTO "ProfilePreferenceOption" ("id", "type", "label", "subtitle", "iconKey", "accentColor", "slug", "sortOrder", "isActive", "updatedAt")
SELECT gen_random_uuid()::text, 'AGE_RANGE', v.label, NULL, v.slug, NULL, v.slug, v.ord, true, NOW()
FROM (VALUES
  ('Under 18', 'under_18', 1),
  ('18 - 24', '18_24', 2),
  ('25 - 34', '25_34', 3),
  ('35 - 44', '35_44', 4),
  ('45 - 54', '45_54', 5),
  ('55 - 64', '55_64', 6),
  ('65+', '65_plus', 7)
) AS v(label, slug, ord)
WHERE NOT EXISTS (SELECT 1 FROM "ProfilePreferenceOption" o WHERE o."type" = 'AGE_RANGE' AND o."slug" = v.slug);

INSERT INTO "ProfilePreferenceOption" ("id", "type", "label", "subtitle", "iconKey", "accentColor", "slug", "sortOrder", "isActive", "updatedAt")
SELECT gen_random_uuid()::text, 'RAID_CITY', v.label, NULL, NULL, NULL, v.slug, v.ord, true, NOW()
FROM (VALUES
  ('Tel Aviv', 'tel_aviv', 1),
  ('Jerusalem', 'jerusalem', 2),
  ('Haifa', 'haifa', 3),
  ('Rishon LeZion', 'rishon_lezion', 4),
  ('Petah Tikva', 'petah_tikva', 5),
  ('Netanya', 'netanya', 6)
) AS v(label, slug, ord)
WHERE NOT EXISTS (SELECT 1 FROM "ProfilePreferenceOption" o WHERE o."type" = 'RAID_CITY' AND o."slug" = v.slug);

INSERT INTO "ProfilePreferenceOption" ("id", "type", "label", "subtitle", "iconKey", "accentColor", "slug", "sortOrder", "isActive", "updatedAt")
SELECT gen_random_uuid()::text, 'INTEREST', v.label, v.subtitle, v.icon, v.color, v.slug, v.ord, true, NOW()
FROM (VALUES
  ('All Categories', NULL, 'all', '#8B5CF6', 'all_categories', 1),
  ('Fashion', 'Clothes & Accessories', 'fashion', '#3B82F6', 'fashion', 2),
  ('Cosmetics', NULL, 'cosmetics', '#EC4899', 'cosmetics', 3),
  ('Sports Equipment', NULL, 'sports', '#34D399', 'sports', 4),
  ('Events', 'Concerts, Movies, Festivals & More', 'events', '#F59E0B', 'events', 5),
  ('Toys', NULL, 'toys', '#F472B6', 'toys', 6),
  ('Toddler Equipment', NULL, 'toddler', '#A78BFA', 'toddler', 7),
  ('Vacations', NULL, 'vacations', '#38BDF8', 'vacations', 8)
) AS v(label, subtitle, icon, color, slug, ord)
WHERE NOT EXISTS (SELECT 1 FROM "ProfilePreferenceOption" o WHERE o."type" = 'INTEREST' AND o."slug" = v.slug);

/**
 * Updates swagger.json — USER routes only (single-player, store guards, notification prefs).
 * Full 200/4xx/5xx bodies with msg (matches rest of Raidr swagger).
 * Run: node scripts/patch-swagger-user-single-player.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swaggerPath = path.join(__dirname, "..", "swagger.json");
const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

const bearer = [{ bearerAuth: [] }];

/** Standard error JSON: { status: false, msg: "..." } */
const err = (description, exampleMsg, extraSchemaProps = {}) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["status", "msg"],
        properties: {
          status: { type: "boolean", example: false },
          msg: { type: "string", example: exampleMsg },
          ...extraSchemaProps,
        },
      },
      example: {
        status: false,
        msg: exampleMsg,
        ...Object.fromEntries(
          Object.entries(extraSchemaProps).map(([k, v]) => [
            k,
            v.example ?? (v.type === "integer" ? 0 : v.type === "boolean" ? true : {}),
          ])
        ),
      },
    },
  },
});

const E401 = err("Unauthorized", "Not authorized, token failed");
const E500 = err("Internal server error", "Something went wrong");
const withAuth = (responses) => ({ ...responses, 401: E401, 500: E500 });

const okJson = (description, schema, example) => ({
  description,
  content: {
    "application/json": {
      schema,
      ...(example ? { example } : {}),
    },
  },
});

Object.assign(swagger.components.schemas, {
  CaptureTimeBreakdown: {
    type: "object",
    properties: {
      baseSec: { type: "integer", example: 30 },
      ownershipDefenseSec: { type: "integer", example: 20 },
      guardPenaltySec: { type: "integer", example: 90 },
      guardCount: { type: "integer", example: 3 },
    },
  },
  B2bHoldProgress: {
    type: "object",
    nullable: true,
    properties: {
      holdDurationHours: { type: "number", example: 72 },
      holdElapsedHours: { type: "number", example: 32 },
      holdComplete: { type: "boolean", example: false },
      holdStartedAt: { type: "string", format: "date-time" },
      progressPercent: { type: "integer", example: 44 },
      holdRemainingSeconds: { type: "integer", example: 144000 },
    },
  },
  SinglePlayerB2bBlock: {
    type: "object",
    nullable: true,
    properties: {
      rewardType: { type: "string", enum: ["DIGITAL_COUPON", "PHYSICAL", "CASH"] },
      rewardTitle: { type: "string" },
      rewardDescription: { type: "string", nullable: true },
      rewardImageUrl: { type: "string", nullable: true },
      hold: { $ref: "#/components/schemas/B2bHoldProgress" },
      canClaim: { type: "boolean" },
    },
  },
  ZoneOwnerSummary: {
    type: "object",
    nullable: true,
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      photoUrl: { type: "string", nullable: true },
    },
  },
  SinglePlayerZoneLeaderboardEntry: {
    type: "object",
    properties: {
      rank: { type: "integer" },
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
      photoUrl: { type: "string" },
      avatarUrl: { type: "string" },
      coins: { type: "integer" },
      isWinner: { type: "boolean" },
      isYou: { type: "boolean" },
    },
  },
  SinglePlayerZoneLeaderboard: {
    type: "object",
    nullable: true,
    description:
      "Top coin earners on this zone (passive ledger). viewer set when authenticated user rank > 3.",
    properties: {
      zoneId: { type: "string", format: "uuid" },
      zoneType: { type: "string", enum: ["NORMAL", "B2B"] },
      sortBy: { type: "string", example: "coins_from_zone" },
      top: {
        type: "array",
        items: { $ref: "#/components/schemas/SinglePlayerZoneLeaderboardEntry" },
      },
      viewer: {
        allOf: [{ $ref: "#/components/schemas/SinglePlayerZoneLeaderboardEntry" }],
        nullable: true,
      },
      winnerAnnounced: { type: "boolean" },
      winnerUserId: { type: "string", format: "uuid", nullable: true },
    },
  },
  SinglePlayerZoneFormatted: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      latitude: { type: "string" },
      longitude: { type: "string" },
      radius: { type: "integer" },
      coinsPerHour: { type: "integer" },
      zoneType: { type: "string", enum: ["NORMAL", "B2B"] },
      imageUrl: { type: "string", nullable: true },
      brandLogoUrl: { type: "string", nullable: true },
      currentOwnerId: { type: "string", format: "uuid", nullable: true },
      shieldExpiresAt: { type: "string", format: "date-time", nullable: true },
      ownedAt: { type: "string", format: "date-time", nullable: true },
      guardCount: { type: "integer" },
      maxGuardsPerZone: { type: "integer", example: 5 },
      status: { type: "string", enum: ["available", "conquered_by_me", "conquered_by_others"] },
      mapPinType: { type: "string", enum: ["YOUR_ZONE", "NEUTRAL", "B2B", "VULNERABLE", "ENEMY_SHIELDED"] },
      isShieldActive: { type: "boolean" },
      isAttackable: { type: "boolean" },
      captureTimeSec: { type: "integer" },
      defenseBonusSec: { type: "integer" },
      captureTimeBreakdown: { $ref: "#/components/schemas/CaptureTimeBreakdown" },
      minOwnedZonesRequired: { type: "integer", nullable: true },
      eligibilityNote: { type: "string", nullable: true },
      meetsEligibility: { type: "boolean", nullable: true },
      b2b: { $ref: "#/components/schemas/SinglePlayerB2bBlock" },
      leaderboard: { $ref: "#/components/schemas/SinglePlayerZoneLeaderboard" },
      owner: { $ref: "#/components/schemas/ZoneOwnerSummary" },
    },
  },
  SinglePlayerGameConfigUser: {
    type: "object",
    properties: {
      baseCaptureTimeSec: { type: "integer", example: 30 },
      shieldDurationMin: { type: "integer", example: 60 },
      ownershipDefenseSecPerDay: { type: "integer", example: 10 },
      secondsPerGuard: { type: "integer", example: 30 },
      maxGuardsPerZone: { type: "integer", example: 5 },
      guardPurchaseCoinPrice: { type: "integer", example: 100 },
      guardEliminationCoinPrice: { type: "integer", example: 50 },
      empireVipMinOwnedZones: { type: "integer", example: 5 },
      vipRewardMultiplier: { type: "number", example: 1 },
      maxOwnedZonesPerPlayer: { type: "integer", nullable: true, example: 5 },
      shieldWarningMinutesBefore: { type: "integer", example: 15 },
      rivalryMilestoneHours: { type: "array", items: { type: "integer" }, example: [24, 48] },
      allowedHoldDurationHours: { type: "array", items: { type: "integer" }, example: [24, 48, 72] },
    },
  },
  SinglePlayerDashboardBlock: {
    type: "object",
    properties: {
      ownedZonesCount: { type: "integer" },
      maxOwnedZonesPerPlayer: { type: "integer", nullable: true },
      empireVipMinOwnedZones: { type: "integer" },
      isVip: { type: "boolean" },
      vipRewardMultiplier: { type: "number" },
      passiveIncomePerHour: { type: "number" },
      daysUntilNextRareDrop: { type: "integer" },
    },
  },
  GuardQuantityRequest: {
    type: "object",
    required: ["quantity"],
    properties: { quantity: { type: "integer", minimum: 1, example: 1 } },
  },
  CaptureLocationRequest: {
    type: "object",
    required: ["latitude", "longitude"],
    properties: {
      latitude: { type: "number", example: 40.7829 },
      longitude: { type: "number", example: -73.9654 },
    },
  },
  StoreItemUser: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      itemType: { type: "string", enum: ["AVATAR", "GUARD"] },
      frontUrl: { type: "string" },
      backUrl: { type: "string", nullable: true },
      price: { type: "integer" },
      guardsPerPurchase: { type: "integer" },
      isNew: { type: "boolean" },
      isFeatured: { type: "boolean" },
      isOwned: { type: "boolean" },
    },
  },
  StorePurchaseRequest: {
    type: "object",
    properties: {
      storeItemId: { type: "string", format: "uuid" },
      avatarId: { type: "string", format: "uuid", description: "Legacy alias for storeItemId" },
      quantity: { type: "integer", minimum: 1, example: 1 },
    },
  },
  PushNotificationFcmData: {
    type: "object",
    description:
      "FCM `data` map on server-sent pushes (all values strings). Sent alongside notification title/body. See docs/NOTIFICATIONS.md and docs/NOTIFICATION_TEST_API.md.",
    properties: {
      category: {
        type: "string",
        description: "Matches a UserNotificationPreference toggle key when the push is category-gated.",
        enum: [
          "dailyDropReminders",
          "rareDropAlerts",
          "raidZoneShield",
          "zoneAttackSnatch",
          "b2bRivalryNearby",
          "rewardsVoucher",
          "eventsCoinRush",
          "promotionalSponsored",
        ],
        example: "rareDropAlerts",
      },
      type: {
        type: "string",
        description: "Deep-link routing action (snake_case).",
        enum: [
          "rare_drop_spawned",
          "shield_expiring",
          "zone_under_attack",
          "zone_snatched",
          "b2b_rivalry_milestone",
          "b2b_reward_claimed",
          "brand_month_reward",
          "coin_rush_starts_20m",
          "coin_rush_starts_10m",
          "coin_rush_live",
          "coin_rush_completed",
          "coin_rush_scheduled_nearby",
          "live_raid_new_nearby",
          "live_raid_starts_20m",
          "live_raid_starts_10m",
          "live_raid_live",
          "live_raid_completed",
          "referral_reward",
          "test",
        ],
        example: "rare_drop_spawned",
      },
      zoneId: { type: "string", format: "uuid", description: "SinglePlayerZone.id" },
      dropId: { type: "string", format: "uuid", description: "DailyDrop.id" },
      eventId: {
        type: "string",
        format: "uuid",
        description: "LiveEvent.id or CoinRushEvent.id (use with eventKind).",
      },
      eventKind: { type: "string", enum: ["live_raid", "coin_rush"], example: "coin_rush" },
      claimId: { type: "string", format: "uuid", description: "SinglePlayerB2bClaim.id" },
      userVoucherId: { type: "string", format: "uuid", description: "UserVoucher.id" },
      campaignId: { type: "string", format: "uuid", description: "BrandMonthCampaign.id" },
      milestoneHours: { type: "string", example: "24", description: "B2B rivalry milestone hours." },
    },
    example: {
      category: "rareDropAlerts",
      type: "rare_drop_spawned",
      dropId: "3b0f718f-1f1b-4c6a-628a-3e727421a7e7",
    },
  },
  PushNavigationTestRequest: {
    type: "object",
    required: ["fcmToken", "type"],
    description:
      "POST /test/push-navigation — send a device push with production FCM `data` for navigation QA.",
    properties: {
      fcmToken: {
        type: "string",
        description: "Device FCM token from the mobile app.",
        example: "YOUR_DEVICE_FCM_TOKEN",
      },
      type: {
        type: "string",
        description: "Deep-link routing action. Use GET /test/push-navigation/types for the full list.",
        enum: [
          "rare_drop_spawned",
          "shield_expiring",
          "zone_under_attack",
          "zone_snatched",
          "b2b_rivalry_milestone",
          "b2b_reward_claimed",
          "brand_month_reward",
          "coin_rush_starts_20m",
          "coin_rush_starts_10m",
          "coin_rush_live",
          "coin_rush_completed",
          "coin_rush_scheduled_nearby",
          "live_raid_new_nearby",
          "live_raid_starts_20m",
          "live_raid_starts_10m",
          "live_raid_live",
          "live_raid_completed",
          "referral_reward",
          "test",
        ],
        example: "zone_under_attack",
      },
      title: { type: "string", description: "Optional notification title override." },
      body: { type: "string", description: "Optional notification body override." },
      secret: {
        type: "string",
        description: "Required when server env PUSH_NAV_TEST_SECRET is set.",
      },
      zoneId: { type: "string", format: "uuid", description: "SinglePlayerZone.id" },
      dropId: { type: "string", format: "uuid", description: "DailyDrop.id" },
      eventId: { type: "string", format: "uuid", description: "LiveEvent or CoinRushEvent id" },
      eventKind: { type: "string", enum: ["live_raid", "coin_rush"] },
      claimId: { type: "string", format: "uuid" },
      userVoucherId: { type: "string", format: "uuid" },
      campaignId: { type: "string", format: "uuid" },
      milestoneHours: { type: "string", example: "24" },
      category: { type: "string", description: "Override FCM data.category (preference key)." },
    },
    example: {
      fcmToken: "YOUR_DEVICE_FCM_TOKEN",
      type: "zone_under_attack",
      zoneId: "real-zone-uuid-optional",
    },
  },
  PushNavigationTestResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string", example: "Navigation test push sent" },
      sent: {
        type: "object",
        properties: {
          title: { type: "string", example: "[Test] Your zone is under attack" },
          body: { type: "string" },
          data: { $ref: "#/components/schemas/PushNotificationFcmData" },
        },
      },
    },
  },
  UserNotificationPreference: {
    type: "object",
    description:
      "In-app notification toggles. Server push honors masterEnabled + each category (except dailyDropReminders — client-local reminders only). FCM data.category uses these keys.",
    properties: {
      userId: { type: "string", format: "uuid" },
      masterEnabled: { type: "boolean", description: "Global push master switch." },
      dailyDropReminders: {
        type: "boolean",
        description: "Client-only: schedule local daily-drop reminders when true. Backend does not send this category via FCM.",
      },
      rareDropAlerts: { type: "boolean", description: "Rare daily drop spawned (FCM includes dropId)." },
      raidZoneShield: { type: "boolean", description: "Shield expiring soon on owned zone (zoneId)." },
      zoneAttackSnatch: { type: "boolean", description: "Zone under attack / snatched (zoneId)." },
      b2bRivalryNearby: { type: "boolean", description: "Nearby B2B hold milestone (zoneId, milestoneHours)." },
      rewardsVoucher: { type: "boolean", description: "B2B claim and Brand Month voucher (claimId / userVoucherId)." },
      eventsCoinRush: { type: "boolean", description: "Coin Rush scheduled, reminders, live, completed (eventId)." },
      promotionalSponsored: {
        type: "boolean",
        description: "Live raid geo alerts and merchant new-raid nearby (eventId, eventKind live_raid).",
      },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  B2bClaimZoneSummary: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string", example: "McDonald's Raid" },
      b2bRewardImageUrl: { type: "string", nullable: true },
      brandLogoUrl: { type: "string", nullable: true },
    },
  },
  SinglePlayerB2bClaim: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      zoneId: { type: "string", format: "uuid" },
      holdStartedAt: { type: "string", format: "date-time" },
      rewardType: { type: "string", enum: ["DIGITAL_COUPON", "PHYSICAL", "CASH"] },
      rewardTitle: { type: "string" },
      rewardDescription: { type: "string", nullable: true },
      claimCode: { type: "string", nullable: true },
      isRedeemed: { type: "boolean" },
      redeemedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      zone: { $ref: "#/components/schemas/B2bClaimZoneSummary" },
    },
  },
  DailyDropCollectReward: {
    type: "object",
    nullable: true,
    properties: {
      type: { type: "string", enum: ["COINS", "BOOST", "INSTANT_CAPTURE", "AVATAR", "VOUCHER"] },
      amount: { type: "integer" },
      multiplier: { type: "number" },
      expiresAt: { type: "string", format: "date-time" },
      frontUrl: { type: "string" },
      backUrl: { type: "string" },
      redemptionCode: { type: "string" },
      title: { type: "string" },
      sponsor: { type: "string" },
      imageUrl: { type: "string" },
    },
  },
  SponsoredThemeDto: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      isActive: { type: "boolean" },
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
      latitude: { type: "number", nullable: true },
      longitude: { type: "number", nullable: true },
      radius: { type: "integer", nullable: true },
      mapOverlayUrl: { type: "string", nullable: true },
    },
  },
  SinglePlayerHistoryBundle: {
    type: "object",
    properties: {
      dailyDrops: { type: "array", items: { $ref: "#/components/schemas/DailyDropDto" } },
      rareDrops: { type: "array", items: { $ref: "#/components/schemas/DailyDropDto" } },
      raidZones: { type: "array", items: { $ref: "#/components/schemas/SinglePlayerZoneFormatted" } },
    },
  },
  CommercialVoucherDto: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      sponsorName: { type: "string" },
      imageUrl: { type: "string", nullable: true },
      redemptionCode: { type: "string", nullable: true },
    },
  },
  UserVoucherDto: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      voucherId: { type: "string", format: "uuid" },
      isRedeemed: { type: "boolean" },
      redeemedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      voucher: { $ref: "#/components/schemas/CommercialVoucherDto" },
    },
  },
  DailyDropDto: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string" },
      latitude: { type: "number" },
      longitude: { type: "number" },
      isCollected: { type: "boolean" },
      isRare: { type: "boolean" },
      rewardType: { type: "string", example: "100_COINS" },
      createdAt: { type: "string", format: "date-time" },
      distanceMeters: { type: "integer", description: "Present on dashboard dailyDrop only" },
      isNewlySpawned: { type: "boolean", description: "Present on dashboard dailyDrop only" },
    },
  },
});

const gameConfigExample = {
  status: true,
  data: {
    baseCaptureTimeSec: 30,
    shieldDurationMin: 60,
    ownershipDefenseSecPerDay: 10,
    secondsPerGuard: 30,
    maxGuardsPerZone: 5,
    guardPurchaseCoinPrice: 100,
    guardEliminationCoinPrice: 50,
    empireVipMinOwnedZones: 5,
    vipRewardMultiplier: 1,
    maxOwnedZonesPerPlayer: 5,
    shieldWarningMinutesBefore: 15,
    rivalryMilestoneHours: [24, 48],
    allowedHoldDurationHours: [24, 48, 72],
  },
};

const zoneListParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
  {
    name: "status",
    in: "query",
    schema: { type: "string", enum: ["available", "conquered_by_me", "conquered_by_others"] },
  },
  { name: "latitude", in: "query", schema: { type: "number" }, description: "User GPS" },
  { name: "longitude", in: "query", schema: { type: "number" } },
  { name: "city", in: "query", schema: { type: "string" } },
  { name: "radiusKm", in: "query", schema: { type: "number" } },
];

const pathId = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

/** Swagger UI sometimes shows "string" unless example is set on the body. */
const captureLocationBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/CaptureLocationRequest" },
      example: { latitude: 40.7829, longitude: -73.9654 },
    },
  },
};

const sampleZoneFormatted = {
  id: "3b0f718f-1f1b-4c6a-628a-3e727421a7e7",
  name: "Postman Test Zone",
  latitude: "40.7829",
  longitude: "-73.9654",
  radius: 80,
  coinsPerHour: 30,
  zoneType: "NORMAL",
  guardCount: 2,
  maxGuardsPerZone: 5,
  status: "conquered_by_me",
  mapPinType: "YOUR_ZONE",
  isShieldActive: true,
  isAttackable: false,
  captureTimeSec: 110,
  defenseBonusSec: 80,
  captureTimeBreakdown: { baseSec: 30, ownershipDefenseSec: 20, guardPenaltySec: 60, guardCount: 2 },
  b2b: null,
};

const sampleB2bClaim = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  userId: "user-uuid",
  zoneId: "zone-uuid",
  holdStartedAt: "2026-10-10T08:00:00.000Z",
  rewardType: "PHYSICAL",
  rewardTitle: "Meal Voucher",
  rewardDescription: "Redeem at participating restaurant",
  claimCode: "RAIDR-MEAL2026",
  isRedeemed: false,
  redeemedAt: null,
  createdAt: "2026-10-12T14:00:00.000Z",
  zone: {
    id: "zone-uuid",
    name: "McDonald's Raid",
    b2bRewardImageUrl: "https://example.com/meal.png",
    brandLogoUrl: "https://example.com/m.png",
  },
};

swagger.paths["/single-player/zones"] = {
  get: {
    tags: ["Single Player"],
    summary: "List single player zones (map / My Raid Zones)",
    security: bearer,
    parameters: zoneListParams,
    responses: withAuth({
      200: okJson(
        "Zones fetched successfully",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { type: "array", items: { $ref: "#/components/schemas/SinglePlayerZoneFormatted" } },
            pagination: {
              type: "object",
              properties: {
                total: { type: "integer" },
                page: { type: "integer" },
                limit: { type: "integer" },
                totalPages: { type: "integer" },
              },
            },
          },
        },
        { status: true, data: [sampleZoneFormatted], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } }
      ),
    }),
  },
};

swagger.paths["/single-player/zones/{id}"] = {
  get: {
    tags: ["Single Player"],
    summary: "Get one zone (detail refresh)",
    security: bearer,
    parameters: [
      pathId,
      { name: "latitude", in: "query", schema: { type: "number" } },
      { name: "longitude", in: "query", schema: { type: "number" } },
    ],
    responses: withAuth({
      200: okJson(
        "Zone detail",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/SinglePlayerZoneFormatted" },
          },
        },
        { status: true, data: { ...sampleZoneFormatted, status: "conquered_by_others", mapPinType: "VULNERABLE", isAttackable: true } }
      ),
      404: err("Zone not found or not visible on map", "Zone not found"),
    }),
  },
};

swagger.paths["/single-player/dashboard"] = {
  get: {
    tags: ["Single Player"],
    summary: "Map dashboard (stats, zones, daily drop)",
    security: bearer,
    parameters: [
      { name: "latitude", in: "query", required: true, schema: { type: "number" } },
      { name: "longitude", in: "query", required: true, schema: { type: "number" } },
      { name: "city", in: "query", schema: { type: "string" } },
    ],
    responses: withAuth({
      200: okJson(
        "Dashboard loaded",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                dashboard: { $ref: "#/components/schemas/SinglePlayerDashboardBlock" },
                dailyDrop: { allOf: [{ $ref: "#/components/schemas/DailyDropDto" }], nullable: true },
                zones: { type: "array", items: { $ref: "#/components/schemas/SinglePlayerZoneFormatted" } },
              },
            },
          },
        },
        {
          status: true,
          data: {
            dashboard: {
              ownedZonesCount: 2,
              maxOwnedZonesPerPlayer: 5,
              passiveIncomePerHour: 120,
              isVip: false,
              empireVipMinOwnedZones: 5,
              vipRewardMultiplier: 1,
              daysUntilNextRareDrop: 3,
            },
            dailyDrop: null,
            zones: [sampleZoneFormatted],
          },
        }
      ),
      400: err("Missing query params", "Latitude and longitude are required in query params"),
    }),
  },
};

swagger.paths["/single-player/game-config"] = {
  get: {
    tags: ["Single Player"],
    summary: "Gameplay constants for mobile",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Game config",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/SinglePlayerGameConfigUser" },
          },
        },
        gameConfigExample
      ),
    }),
  },
};

swagger.paths["/single-player/empire"] = {
  get: {
    tags: ["Single Player"],
    summary: "Empire / VIP from owned zone count",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Empire status",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                ownedZonesCount: { type: "integer" },
                empireVipMinOwnedZones: { type: "integer" },
                isVip: { type: "boolean" },
                vipRewardMultiplier: { type: "number" },
              },
            },
          },
        },
        {
          status: true,
          data: { ownedZonesCount: 2, empireVipMinOwnedZones: 5, isVip: false, vipRewardMultiplier: 1 },
        }
      ),
    }),
  },
};

swagger.paths["/single-player/guards/inventory"] = {
  get: {
    tags: ["Single Player"],
    summary: "Guard inventory and config prices",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Inventory",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                inventory: { type: "integer" },
                raidrCoins: { type: "integer" },
                guardPurchaseCoinPrice: { type: "integer" },
                guardEliminationCoinPrice: { type: "integer" },
                maxGuardsPerZone: { type: "integer" },
              },
            },
          },
        },
        {
          status: true,
          data: {
            inventory: 7,
            raidrCoins: 2450,
            guardPurchaseCoinPrice: 100,
            guardEliminationCoinPrice: 50,
            maxGuardsPerZone: 5,
          },
        }
      ),
    }),
  },
};

swagger.paths["/single-player/guards/purchase"] = {
  post: {
    tags: ["Single Player"],
    summary: "Deprecated — use Store GUARD purchase",
    deprecated: true,
    security: bearer,
    responses: withAuth({
      410: okJson(
        "Endpoint removed",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: false },
            msg: { type: "string" },
            storeItemsPath: { type: "string" },
            storePurchasePath: { type: "string" },
          },
        },
        {
          status: false,
          msg: "Guard purchase moved to the Store. Use GET /api/store/all-items?itemType=GUARD and POST /api/store/purchase.",
          storeItemsPath: "/api/store/all-items?itemType=GUARD",
          storePurchasePath: "/api/store/purchase",
        }
      ),
    }),
  },
};

const guardAssignOk = okJson(
  "Guards updated",
  {
    type: "object",
    properties: {
      status: { type: "boolean", example: true },
      msg: { type: "string" },
      data: {
        type: "object",
        properties: {
          zoneId: { type: "string" },
          guardCount: { type: "integer" },
          inventory: { type: "integer" },
        },
      },
    },
  },
  { status: true, msg: "Guards assigned to zone", data: { zoneId: "uuid", guardCount: 3, inventory: 6 } }
);

const guardAssignResponses = withAuth({
  200: guardAssignOk,
  400: err("Bad request", "Not enough guards in inventory"),
  403: err("Forbidden", "You must own this zone to assign guards"),
  404: err("Not found", "Zone not found or inactive"),
});

swagger.paths["/single-player/zones/{id}/guards/assign"] = {
  post: {
    tags: ["Single Player"],
    summary: "Assign guards from inventory to owned zone",
    security: bearer,
    parameters: [pathId],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/GuardQuantityRequest" },
          example: { quantity: 1 },
        },
      },
    },
    responses: guardAssignResponses,
  },
};

swagger.paths["/single-player/zones/{id}/guards/unassign"] = {
  post: {
    tags: ["Single Player"],
    summary: "Return guards from zone to inventory",
    security: bearer,
    parameters: [pathId],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/GuardQuantityRequest" },
          example: { quantity: 1 },
        },
      },
    },
    responses: withAuth({
      ...guardAssignResponses,
      200: okJson(
        "Guards returned",
        guardAssignOk.content["application/json"].schema,
        { status: true, msg: "Guards returned to inventory", data: { zoneId: "uuid", guardCount: 2, inventory: 8 } }
      ),
      400: err("Bad request", "Zone does not have that many guards"),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/capture/start"] = {
  post: {
    tags: ["Single Player"],
    summary: "Start hold-to-capture / snatch",
    security: bearer,
    parameters: [pathId],
    requestBody: captureLocationBody,
    responses: withAuth({
      200: okJson(
        "Capture started",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string", example: "Capture started" },
            captureTimeSec: { type: "integer" },
            captureTimeBreakdown: { $ref: "#/components/schemas/CaptureTimeBreakdown" },
            distanceMeters: { type: "integer" },
            startedAt: { type: "string", format: "date-time" },
            completesAfter: { type: "string", format: "date-time" },
          },
        },
        {
          status: true,
          msg: "Capture started",
          captureTimeSec: 200,
          captureTimeBreakdown: { baseSec: 30, ownershipDefenseSec: 20, guardPenaltySec: 150, guardCount: 5 },
          distanceMeters: 18,
          startedAt: "2026-10-12T12:00:00.000Z",
          completesAfter: "2026-10-12T12:03:20.000Z",
        }
      ),
      400: err("Bad request", "You must be within 50m of the zone."),
      403: err("Forbidden", "You can own at most 5 zones.", {
        ownedZonesCount: { type: "integer", example: 5 },
        maxOwnedZonesPerPlayer: { type: "integer", example: 5 },
      }),
      404: err("Not found", "Zone not found or inactive"),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/capture/ping"] = {
  post: {
    tags: ["Single Player"],
    summary: "Ping during capture (stay in radius)",
    description:
      "Call every few seconds while the player holds snatch. Server checks GPS is still inside zone radius and returns remaining capture time. If the player leaves the radius, returns 400 with cancelled: true and clears the Redis capture session.",
    security: bearer,
    parameters: [pathId],
    requestBody: captureLocationBody,
    responses: withAuth({
      200: okJson(
        "Still in radius",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            inRadius: { type: "boolean" },
            remainingSec: { type: "integer" },
          },
        },
        { status: true, inRadius: true, remainingSec: 45 }
      ),
      400: err("Capture cancelled", "Left zone radius — capture cancelled.", {
        cancelled: { type: "boolean", example: true },
      }),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/capture/cancel"] = {
  post: {
    tags: ["Single Player"],
    summary: "Cancel capture attempt",
    security: bearer,
    parameters: [pathId],
    responses: withAuth({
      200: okJson(
        "Cancelled",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string", example: "Capture cancelled" },
          },
        },
        { status: true, msg: "Capture cancelled" }
      ),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/capture/complete"] = {
  post: {
    tags: ["Single Player"],
    summary: "Complete capture after timer",
    security: bearer,
    parameters: [pathId],
    requestBody: captureLocationBody,
    responses: withAuth({
      200: okJson(
        "Capture complete",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            shieldExpiresAt: { type: "string", format: "date-time" },
            ownedAt: { type: "string", format: "date-time" },
          },
        },
        {
          status: true,
          msg: "Zone captured successfully",
          shieldExpiresAt: "2026-10-12T13:00:00.000Z",
          ownedAt: "2026-10-12T12:00:00.000Z",
        }
      ),
      400: err("Timer not met", "Capture time not met. Hold position until the timer completes.", {
        remainingSec: { type: "integer", example: 12 },
      }),
      403: err("Zone cap", "You can own at most 5 zones.", {
        ownedZonesCount: { type: "integer", example: 5 },
        maxOwnedZonesPerPlayer: { type: "integer", example: 5 },
      }),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/capture/eliminate-guards"] = {
  post: {
    tags: ["Single Player"],
    summary: "Eliminate guards during capture (AR)",
    security: bearer,
    parameters: [pathId],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { count: { type: "integer", minimum: 1, example: 1 } },
          },
          example: { count: 1 },
        },
      },
    },
    responses: withAuth({
      200: okJson(
        "Guard eliminated",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            data: {
              type: "object",
              properties: {
                guardsEliminated: { type: "integer" },
                coinsSpent: { type: "integer" },
                zoneGuardCount: { type: "integer" },
                captureTimeSec: { type: "integer" },
                raidrCoins: { type: "integer" },
              },
            },
          },
        },
        {
          status: true,
          msg: "Guards eliminated",
          data: { guardsEliminated: 1, coinsSpent: 50, zoneGuardCount: 4, captureTimeSec: 170, raidrCoins: 2400 },
        }
      ),
      400: err("Bad request", "Insufficient RAIDR Coins"),
    }),
  },
};

swagger.paths["/single-player/zones/{id}/b2b/claim"] = {
  post: {
    tags: ["Single Player"],
    summary: "Claim B2B reward after hold complete",
    security: bearer,
    parameters: [pathId],
    responses: withAuth({
      200: okJson(
        "Claim created",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            data: { $ref: "#/components/schemas/SinglePlayerB2bClaim" },
          },
        },
        { status: true, msg: "B2B reward claimed successfully", data: sampleB2bClaim }
      ),
      400: err("Hold incomplete", "Hold requirement not complete yet", {
        data: { $ref: "#/components/schemas/B2bHoldProgress" },
      }),
      403: err("Forbidden", "You must own this zone to claim"),
      404: err("Not found", "B2B zone not found"),
      409: err("Conflict", "Reward already claimed for this hold streak"),
    }),
  },
};

swagger.paths["/single-player/b2b/claims"] = {
  get: {
    tags: ["Single Player"],
    summary: "List my B2B claims",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Claims list",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { type: "array", items: { $ref: "#/components/schemas/SinglePlayerB2bClaim" } },
          },
        },
        { status: true, data: [sampleB2bClaim] }
      ),
    }),
  },
};

swagger.paths["/single-player/b2b/claims/{claimId}/redeem"] = {
  post: {
    tags: ["Single Player"],
    summary: "Mark B2B claim redeemed",
    security: bearer,
    parameters: [
      { name: "claimId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
    ],
    responses: withAuth({
      200: okJson(
        "Redeemed",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            data: { $ref: "#/components/schemas/SinglePlayerB2bClaim" },
          },
        },
        {
          status: true,
          msg: "Claim marked as redeemed",
          data: { ...sampleB2bClaim, isRedeemed: true, redeemedAt: "2026-10-12T16:00:00.000Z" },
        }
      ),
      400: err("Bad request", "Already redeemed"),
      404: err("Not found", "Claim not found"),
    }),
  },
};

swagger.paths["/store/all-items"] = {
  get: {
    tags: ["Store"],
    summary: "List store items (avatars and guard products)",
    security: bearer,
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", default: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
      {
        name: "itemType",
        in: "query",
        schema: { type: "string", enum: ["AVATAR", "GUARD"] },
        description: "Use GUARD for single-player store tab",
      },
    ],
    responses: withAuth({
      200: okJson(
        "Store items",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            coins: { type: "integer" },
            spGuardInventory: { type: "integer" },
            data: { type: "array", items: { $ref: "#/components/schemas/StoreItemUser" } },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
                hasNextPage: { type: "boolean" },
              },
            },
          },
        },
        {
          status: true,
          msg: "Store items fetched successfully",
          coins: 2450,
          spGuardInventory: 7,
          data: [
            {
              id: "uuid",
              name: "RAIDR Guard",
              itemType: "GUARD",
              price: 50,
              guardsPerPurchase: 1,
              isOwned: false,
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, hasNextPage: false },
        }
      ),
    }),
  },
};

swagger.paths["/store/purchase"] = {
  post: {
    tags: ["Store"],
    summary: "Purchase avatar or guard product",
    security: bearer,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/StorePurchaseRequest" },
          example: { storeItemId: "3b0f718f-1f1b-4c6a-628a-3e727421a7e7", quantity: 1 },
        },
      },
    },
    responses: withAuth({
      200: okJson(
        "Purchase success",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            data: {
              type: "object",
              properties: {
                item: { $ref: "#/components/schemas/StoreItemUser" },
                quantity: { type: "integer" },
                guardsAdded: { type: "integer" },
                raidrCoins: { type: "integer" },
                spGuardInventory: { type: "integer" },
              },
            },
          },
        },
        {
          status: true,
          msg: "Guards purchased successfully",
          data: { quantity: 1, guardsAdded: 1, raidrCoins: 2400, spGuardInventory: 8 },
        }
      ),
      400: err("Bad request", "Insufficient balance"),
      404: err("Not found", "Store item not found"),
    }),
  },
};

swagger.paths["/user/notification-preferences"] = {
  get: {
    tags: ["User"],
    summary: "Get notification preferences",
    description:
      "Returns master + per-category toggles. Server FCM payloads include `data.category` matching these keys (see components.schemas.PushNotificationFcmData). `dailyDropReminders` is for on-device scheduling only.",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Preferences",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/UserNotificationPreference" },
          },
        },
        {
          status: true,
          data: {
            userId: "uuid",
            masterEnabled: true,
            dailyDropReminders: true,
            rareDropAlerts: true,
            raidZoneShield: true,
            zoneAttackSnatch: true,
            b2bRivalryNearby: true,
            rewardsVoucher: true,
            eventsCoinRush: true,
            promotionalSponsored: true,
            updatedAt: "2026-11-03T12:00:00.000Z",
          },
        }
      ),
    }),
  },
  patch: {
    tags: ["User"],
    summary: "Update notification preferences",
    description:
      "Patch any subset of boolean fields (unknown keys rejected). Does not affect FCM token — use PATCH /user/update-fcm.",
    security: bearer,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              masterEnabled: { type: "boolean" },
              dailyDropReminders: {
                type: "boolean",
                description: "Client-local daily drop reminders (not server push).",
              },
              rareDropAlerts: { type: "boolean" },
              raidZoneShield: { type: "boolean" },
              zoneAttackSnatch: { type: "boolean" },
              b2bRivalryNearby: { type: "boolean" },
              rewardsVoucher: { type: "boolean" },
              eventsCoinRush: { type: "boolean" },
              promotionalSponsored: { type: "boolean" },
            },
          },
        },
      },
    },
    responses: withAuth({
      200: okJson(
        "Updated",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string", example: "Notification preferences updated" },
            data: { $ref: "#/components/schemas/UserNotificationPreference" },
          },
        },
        { status: true, msg: "Notification preferences updated", data: { masterEnabled: true } }
      ),
      400: err("Validation error", "Invalid preference payload"),
    }),
  },
};

if (swagger.paths["/user/update-fcm"]?.patch) {
  swagger.paths["/user/update-fcm"].patch.description =
    "Register the device FCM token for server push. Outbound messages include notification title/body plus FCM `data` (schema PushNotificationFcmData) for deep linking.";
}

swagger.paths["/single-player/daily-drop"] = {
  post: {
    tags: ["Single Player"],
    summary: "Get or spawn today's daily drop",
    security: bearer,
    requestBody: captureLocationBody,
    responses: withAuth({
      200: okJson(
        "Existing drop for today",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/DailyDropDto" },
          },
        },
        {
          status: true,
          data: {
            id: "uuid",
            latitude: 40.783,
            longitude: -73.966,
            isCollected: false,
            isRare: false,
            rewardType: "100_COINS",
          },
        }
      ),
      201: okJson(
        "New drop spawned",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            data: { $ref: "#/components/schemas/DailyDropDto" },
          },
        },
        {
          status: true,
          msg: "New daily drop spawned",
          data: { id: "uuid", isRare: true, rewardType: "2X_BOOST_24H", isCollected: false },
        }
      ),
      400: err("Bad request", "Latitude and longitude are required"),
    }),
  },
};

swagger.paths["/single-player/daily-drop/collect"] = {
  post: {
    tags: ["Single Player"],
    summary: "Collect daily drop within range",
    security: bearer,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["dropId", "latitude", "longitude"],
            properties: {
              dropId: { type: "string", format: "uuid" },
              latitude: { type: "number" },
              longitude: { type: "number" },
            },
          },
          example: {
            dropId: "3b0f718f-1f1b-4c6a-628a-3e727421a7e7",
            latitude: 40.7829,
            longitude: -73.9654,
          },
        },
      },
    },
    responses: withAuth({
      200: okJson(
        "Collected",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string" },
            rewardData: { $ref: "#/components/schemas/DailyDropCollectReward" },
          },
        },
        {
          status: true,
          msg: "You found 100 Coins!",
          rewardData: { type: "COINS", amount: 100 },
        }
      ),
      400: err("Bad request", "Too far away to collect. Distance: 120.00m"),
      403: err("Forbidden", "Not your drop"),
      404: err("Not found", "Drop not found"),
    }),
  },
};

swagger.paths["/single-player/history"] = {
  get: {
    tags: ["Single Player"],
    summary: "Single player history",
    description:
      "Without type: returns { dailyDrops, rareDrops, raidZones }. With type query, data is an array of that type only.",
    security: bearer,
    parameters: [
      {
        name: "type",
        in: "query",
        schema: { type: "string", enum: ["dailyDrops", "rareDrops", "raidZones"] },
      },
    ],
    responses: withAuth({
      200: okJson(
        "History",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: {
              oneOf: [
                { $ref: "#/components/schemas/SinglePlayerHistoryBundle" },
                { type: "array", items: { $ref: "#/components/schemas/DailyDropDto" } },
                { type: "array", items: { $ref: "#/components/schemas/SinglePlayerZoneFormatted" } },
              ],
            },
          },
        },
        {
          status: true,
          data: {
            dailyDrops: [
              {
                id: "uuid",
                isCollected: true,
                isRare: false,
                rewardType: "100_COINS",
                latitude: 40.78,
                longitude: -73.96,
              },
            ],
            rareDrops: [],
            raidZones: [sampleZoneFormatted],
          },
        }
      ),
    }),
  },
};

swagger.paths["/single-player/theme"] = {
  get: {
    tags: ["Single Player"],
    summary: "Active sponsored theme",
    security: bearer,
    parameters: [
      { name: "lat", in: "query", schema: { type: "number" }, description: "User latitude if theme is geo-fenced" },
      { name: "lng", in: "query", schema: { type: "number" } },
    ],
    responses: withAuth({
      200: okJson(
        "Theme (data null if none or out of range)",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            msg: { type: "string", nullable: true },
            data: { allOf: [{ $ref: "#/components/schemas/SponsoredThemeDto" }], nullable: true },
          },
        },
        {
          status: true,
          msg: "No active theme",
          data: null,
        }
      ),
    }),
  },
};

swagger.paths["/single-player/vouchers"] = {
  get: {
    tags: ["Single Player"],
    summary: "User commercial vouchers (from rare drops / campaigns)",
    security: bearer,
    responses: withAuth({
      200: okJson(
        "Vouchers list (empty array if none collected)",
        {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            data: { type: "array", items: { $ref: "#/components/schemas/UserVoucherDto" } },
          },
        },
        {
          status: true,
          data: [
            {
              id: "3b0f718f-1f1b-4c6a-628a-3e727421a7e7",
              userId: "user-uuid",
              voucherId: "voucher-uuid",
              isRedeemed: false,
              redeemedAt: null,
              createdAt: "2026-10-12T10:00:00.000Z",
              voucher: {
                id: "voucher-uuid",
                title: "Free Coffee & Pastry",
                description: "Valid at participating locations",
                sponsorName: "Local Cafe",
                imageUrl: "https://example.com/logo.png",
                redemptionCode: "CAFE-2026",
              },
            },
          ],
        }
      ),
    }),
  },
};

swagger.paths["/test/push-navigation/types"] = {
  get: {
    tags: ["Test"],
    summary: "List push navigation test cases",
    description:
      "Returns every FCM `data.type` value with default title/body, category, and ID fields. Optional: set env PUSH_NAV_TEST_SECRET and pass `?secret=` or header x-push-test-secret.",
    parameters: [
      {
        name: "secret",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Required when PUSH_NAV_TEST_SECRET is set on the server.",
      },
    ],
    responses: {
      200: okJson(
        "Catalog",
        {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", example: "rare_drop_spawned" },
                  category: { type: "string", nullable: true },
                  title: { type: "string" },
                  body: { type: "string" },
                  eventKind: { type: "string", nullable: true },
                  idFields: { type: "array", items: { type: "string" } },
                  placeholderIds: { type: "object", additionalProperties: { type: "string" } },
                },
              },
            },
            placeholderIds: { type: "object" },
            hint: { type: "string" },
          },
        },
        {
          success: true,
          data: [{ type: "rare_drop_spawned", category: "rareDropAlerts", idFields: ["dropId"] }],
          hint: "POST /api/test/push-navigation with fcmToken + type",
        }
      ),
      403: err("Forbidden", "Push navigation test is disabled"),
    },
  },
};

swagger.paths["/test/push-navigation"] = {
  post: {
    tags: ["Test"],
    summary: "Send push navigation test (FCM data)",
    description:
      "Sends a real FCM notification with the same `data` shape as production (`PushNotificationFcmData`). **No auth.** Body schema: `PushNavigationTestRequest`. List types: `GET /test/push-navigation/types`.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PushNavigationTestRequest" },
          example: {
            fcmToken: "YOUR_DEVICE_FCM_TOKEN",
            type: "zone_under_attack",
            zoneId: "real-zone-uuid-optional",
          },
          examples: {
            zoneUnderAttack: {
              summary: "Zone under attack (deep link to zone)",
              value: {
                fcmToken: "YOUR_DEVICE_FCM_TOKEN",
                type: "zone_under_attack",
                zoneId: "real-zone-uuid-optional",
              },
            },
            rareDropSpawned: {
              summary: "Rare drop on map",
              value: {
                fcmToken: "YOUR_DEVICE_FCM_TOKEN",
                type: "rare_drop_spawned",
                dropId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
              },
            },
            coinRushLive: {
              summary: "Coin Rush live",
              value: {
                fcmToken: "YOUR_DEVICE_FCM_TOKEN",
                type: "coin_rush_live",
                eventId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
              },
            },
          },
        },
      },
    },
    responses: {
      200: okJson(
        "Sent",
        { $ref: "#/components/schemas/PushNavigationTestResponse" },
        {
          success: true,
          message: "Navigation test push sent",
          sent: {
            title: "[Test] Your zone is under attack",
            body: "Someone started capturing your zone.",
            data: {
              category: "zoneAttackSnatch",
              type: "zone_under_attack",
              zoneId: "real-zone-uuid-optional",
            },
          },
        }
      ),
      400: err("Bad request", "fcmToken is required"),
      403: err("Forbidden", "Push navigation test is disabled"),
      500: err("Internal server error", "Failed to send navigation test push"),
    },
  },
};

const USER_PATH_PREFIXES = ["/single-player", "/store/all-items", "/store/purchase", "/user/notification-preferences"];

for (const pathKey of Object.keys(swagger.paths)) {
  if (!USER_PATH_PREFIXES.some((p) => pathKey === p || pathKey.startsWith("/single-player"))) continue;
  for (const method of Object.keys(swagger.paths[pathKey])) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    const op = swagger.paths[pathKey][method];
    if (!op.responses) op.responses = {};
    if (!op.responses["401"]) op.responses["401"] = E401;
    if (!op.responses["500"]) op.responses["500"] = E500;
    for (const code of Object.keys(op.responses)) {
      const r = op.responses[code];
      if (r.content?.["application/json"] && !r.content["application/json"].example && code !== "200" && code !== "201") {
        const ex = r.content["application/json"].schema?.properties?.msg?.example;
        if (ex) r.content["application/json"].example = { status: false, msg: ex };
      }
    }
  }
}

if (!swagger.tags) swagger.tags = [];
if (!swagger.tags.some((t) => t.name === "Test")) {
  swagger.tags.unshift({
    name: "Test",
    description:
      "Push navigation QA: POST /test/push-navigation (body: PushNavigationTestRequest), GET /test/push-navigation/types.",
  });
}

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log("Patched user SP swagger with full success/error responses + examples");

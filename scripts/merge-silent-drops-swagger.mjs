import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const swaggerPath = path.join(root, 'swagger.json');
const fragmentPath = path.join(root, 'swagger-fragments', 'silent-map-drops.json');

const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf8'));

Object.assign(swagger.components.schemas, fragment.schemas);
Object.assign(swagger.paths, fragment.paths);

const zoneSchema = swagger.components.schemas.SinglePlayerZoneFormatted;
if (zoneSchema?.properties) {
  if (!zoneSchema.properties.type) {
    zoneSchema.properties.type = {
      type: 'string',
      enum: ['NORMAL', 'B2B'],
      description: 'Map layer type on dashboard (same value as zoneType)',
    };
  }
  if (!zoneSchema.properties.isConquered) {
    zoneSchema.properties.isConquered = {
      type: 'boolean',
      description: 'Present on GET /single-player/dashboard zones[]',
    };
  }
}

const dailyDropSchema = swagger.components.schemas.DailyDropDto;
if (dailyDropSchema?.properties && !dailyDropSchema.properties.type) {
  dailyDropSchema.properties.type = {
    type: 'string',
    enum: ['DAILY_DROP', 'DAILY_DROP_RARE'],
    description: 'Present on dashboard dailyDrop',
  };
}

const dashboardGet = swagger.paths['/single-player/dashboard']?.get;
if (dashboardGet) {
  dashboardGet.summary = 'Map dashboard (stats, zones, daily drop, silent map drops)';
  dashboardGet.description =
    'Requires player GPS. silentDrops[] are slim map pins (SilentMapDropMapPin); tap pin → GET /single-player/silent-drops/{id}. Brand Month: GET /single-player/brand-month/active.';

  const radiusKmParam = {
    name: 'radiusKm',
    in: 'query',
    schema: { type: 'number', example: 50 },
    description: 'Discovery radius in km (optional; default from env)',
  };
  const hasRadius = dashboardGet.parameters?.some((p) => p.name === 'radiusKm');
  if (!hasRadius) {
    dashboardGet.parameters = [...(dashboardGet.parameters || []), radiusKmParam];
  }

  const dataProps = dashboardGet.responses?.['200']?.content?.['application/json']?.schema?.properties?.data?.properties;
  if (dataProps) {
    dataProps.silentDrops = {
      type: 'array',
      description: 'Active silent map drops near the player (map pins only)',
      items: { $ref: '#/components/schemas/SilentMapDropMapPin' },
    };
    dataProps.dailyDrop = {
      allOf: [{ $ref: '#/components/schemas/DashboardDailyDropMapPin' }],
      nullable: true,
    };
  }

  const example = dashboardGet.responses?.['200']?.content?.['application/json']?.example;
  if (example?.data) {
    example.data.dailyDrop = {
      type: 'DAILY_DROP',
      id: 'a2222222-2222-2222-2222-222222222222',
      latitude: 33.57,
      longitude: 73.15,
      isCollected: false,
      rewardType: '100_COINS',
      distanceMeters: 450,
      isNewlySpawned: true,
    };
    example.data.silentDrops = [
      {
        type: 'SILENT_DROP_QR',
        id: 'e1111111-1111-1111-1111-111111111111',
        title: 'KFC crunch offer',
        latitude: 33.5650275,
        longitude: 73.1522898,
        mapIconUrl: 'https://cdn.example/kfc-pin.png',
        distanceMeters: 120,
        hasClaimed: false,
      },
      {
        type: 'SILENT_DROP_GPS',
        id: 'e2222222-2222-2222-2222-222222222222',
        title: 'Park coins',
        latitude: 33.566,
        longitude: 73.153,
        mapIconUrl: null,
        distanceMeters: 80,
        hasClaimed: false,
        coinReward: 50,
      },
    ];
    if (Array.isArray(example.data.zones) && example.data.zones[0]) {
      example.data.zones[0].type = example.data.zones[0].zoneType || 'NORMAL';
      example.data.zones[0].isConquered = true;
    }
  }
}

const silentDropHistorySamples = [
  {
    type: 'SILENT_DROP_QR',
    claimId: 'c1111111-1111-1111-1111-111111111111',
    code: 'A1B2C3D4',
    xpEarned: 200,
    coinsAwarded: null,
    payoutType: 'PARTNER_REWARD',
    isRedeemed: true,
    redeemedAt: '2026-11-13T10:00:00.000Z',
    claimedAt: '2026-11-13T10:00:00.000Z',
    drop: {
      id: 'e1111111-1111-1111-1111-111111111111',
      title: 'KFC crunch offer',
      reward: 'Free crunch burger',
      displayMode: 'SILENT_MAP_DROP',
      collectionMethod: 'BUSINESS_QR',
    },
  },
  {
    type: 'SILENT_DROP_GPS',
    claimId: 'c2222222-2222-2222-2222-222222222222',
    code: null,
    xpEarned: 0,
    coinsAwarded: 50,
    payoutType: 'COINS_ONLY',
    isRedeemed: true,
    redeemedAt: '2026-11-12T08:30:00.000Z',
    claimedAt: '2026-11-12T08:30:00.000Z',
    drop: {
      id: 'e2222222-2222-2222-2222-222222222222',
      title: 'Park mystery coins',
      coinReward: 50,
      displayMode: 'SILENT_MAP_DROP',
      collectionMethod: 'GPS_INSTANT',
    },
  },
];

const historyGet = swagger.paths['/single-player/history']?.get;
if (historyGet) {
  historyGet.summary = 'Single player history (daily drops, zones, silent map drops)';
  historyGet.description =
    'Without `type`: returns { dailyDrops, rareDrops, raidZones, silentDrops }. With `type=silentDrops`, `data` is SilentDropMyClaimItem[] (collected GPS + QR silent map drops). Legacy alias: GET /single-player/silent-drops/my-claims.';
  const typeParam = historyGet.parameters?.find((p) => p.name === 'type');
  if (typeParam?.schema) {
    typeParam.schema.enum = ['dailyDrops', 'rareDrops', 'raidZones', 'silentDrops'];
    typeParam.description =
      'Filter history slice. Omit for full bundle including silentDrops (map drop claims, not live pins).';
  }
  const bundle = swagger.components.schemas.SinglePlayerHistoryBundle;
  if (bundle) {
    bundle.description =
      'Combined profile/history payload when GET /single-player/history is called without type.';
    if (bundle.properties) {
      bundle.properties.silentDrops = {
        type: 'array',
        description: 'Collected silent map drops (GPS coins + QR partner rewards)',
        items: { $ref: '#/components/schemas/SilentDropMyClaimItem' },
      };
    }
  }
  const dataSchema = historyGet.responses?.['200']?.content?.['application/json']?.schema?.properties?.data;
  if (dataSchema?.oneOf && !dataSchema.oneOf.some((o) => o.items?.$ref?.includes('SilentDropMyClaimItem'))) {
    dataSchema.oneOf.push({
      type: 'array',
      items: { $ref: '#/components/schemas/SilentDropMyClaimItem' },
    });
  }
  const histExample = historyGet.responses?.['200']?.content?.['application/json']?.example;
  if (histExample?.data && !Array.isArray(histExample.data)) {
    histExample.data.silentDrops = silentDropHistorySamples;
  }
}

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log('Merged silent map drops into swagger.json');

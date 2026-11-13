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

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log('Merged silent map drops into swagger.json');

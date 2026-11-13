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

const dashboardGet = swagger.paths['/single-player/dashboard']?.get;
if (dashboardGet) {
  dashboardGet.summary = 'Map dashboard (stats, zones, daily drop, silent map drops)';
  dashboardGet.description =
    'Requires player GPS. Returns silentDrops[] (SILENT_MAP_DROP pins only — not GET /events). Brand Month: GET /single-player/brand-month/active.';

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
  if (dataProps && !dataProps.silentDrops) {
    dataProps.silentDrops = {
      type: 'array',
      description: 'Active silent map drops near the player',
      items: { $ref: '#/components/schemas/SilentMapDropClient' },
    };
  }

  const example = dashboardGet.responses?.['200']?.content?.['application/json']?.example;
  if (example?.data && example.data.silentDrops === undefined) {
    example.data.silentDrops = [
      {
        id: 'e1111111-1111-1111-1111-111111111111',
        title: 'KFC',
        collectionMethod: 'BUSINESS_QR',
        collectRadiusM: 200,
        latitude: 33.5650275,
        longitude: 73.1522898,
        displayMode: 'SILENT_MAP_DROP',
        status: 'live',
        isClaimed: false,
        distanceMeters: 120,
      },
    ];
  }
}

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log('Merged silent map drops into swagger.json');

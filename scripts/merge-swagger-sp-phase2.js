import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const swaggerPath = path.join(root, "swagger.json");
const extraPath = path.join(__dirname, "swagger-single-player-phase2-paths.json");

const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
const extra = JSON.parse(fs.readFileSync(extraPath, "utf8"));

swagger.paths = { ...swagger.paths, ...extra };

const tagNames = [
  "Admin Single Player",
  "Merchant Single Player",
];
if (!swagger.tags) swagger.tags = [];
for (const name of tagNames) {
  if (!swagger.tags.some((t) => t.name === name)) {
    swagger.tags.push({ name, description: `Single Player Phase 2 — ${name}` });
  }
}

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log(`Merged ${Object.keys(extra).length} paths into swagger.json`);

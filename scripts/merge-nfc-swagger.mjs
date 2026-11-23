import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const swaggerPath = path.join(root, "swagger.json");
const fragmentPath = path.join(root, "swagger-fragments", "nfc-visits.json");

const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
const fragment = JSON.parse(fs.readFileSync(fragmentPath, "utf8"));

swagger.components = swagger.components || {};
swagger.components.schemas = swagger.components.schemas || {};
swagger.paths = swagger.paths || {};
swagger.tags = swagger.tags || [];

Object.assign(swagger.components.schemas, fragment.schemas);
Object.assign(swagger.paths, fragment.paths);

for (const tag of fragment.tags || []) {
  const exists = swagger.tags.some((t) => t.name === tag.name);
  if (!exists) {
    swagger.tags.push(tag);
  }
}

fs.writeFileSync(swaggerPath, `${JSON.stringify(swagger, null, 2)}\n`);
console.log(
  `Merged NFC swagger: ${Object.keys(fragment.paths).length} paths, ${Object.keys(fragment.schemas).length} schemas`
);

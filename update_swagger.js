import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerPath = path.join(__dirname, 'swagger.json');

try {
    const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

    // Admin Store paths
    swaggerData.paths['/admin/store/create'] = {
        post: {
            tags: ["Admin Store"],
            summary: "Create Avatar",
            description: "Create a new Avatar for the store",
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                name: { type: "string", example: "Cyber Ninja" },
                                frontUrl: { type: "string", example: "https://example.com/front.png" },
                                backUrl: { type: "string", example: "https://example.com/back.png" },
                                price: { type: "number", example: 15 },
                                isFeatured: { type: "boolean", example: false },
                                isNew: { type: "boolean", example: true }
                            },
                            required: ["name", "frontUrl", "backUrl", "price"]
                        }
                    }
                }
            },
            responses: {
                "200": { description: "Avatar created successfully" },
                "400": { description: "Validation error" },
                "500": { description: "Server error" }
            }
        }
    };

    swaggerData.paths['/admin/store/get-all'] = {
        get: {
            tags: ["Admin Store"],
            summary: "Get All Store Items",
            description: "Fetch paginated store items with optional search",
            security: [{ bearerAuth: [] }],
            parameters: [
                { in: "query", name: "search", schema: { type: "string" }, description: "Search by avatar name" },
                { in: "query", name: "page", schema: { type: "integer", default: 1 }, description: "Page number" },
                { in: "query", name: "limit", schema: { type: "integer", default: 10 }, description: "Items per page" }
            ],
            responses: {
                "200": { description: "Store items fetched successfully" },
                "500": { description: "Server error" }
            }
        }
    };

    swaggerData.paths['/admin/store/update/{id}'] = {
        put: {
            tags: ["Admin Store"],
            summary: "Update Store Item",
            description: "Update an existing avatar",
            security: [{ bearerAuth: [] }],
            parameters: [
                { in: "path", name: "id", required: true, schema: { type: "string" }, description: "Avatar ID" }
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                frontUrl: { type: "string" },
                                backUrl: { type: "string" },
                                price: { type: "number" },
                                isFeatured: { type: "boolean" },
                                isNew: { type: "boolean" }
                            }
                        }
                    }
                }
            },
            responses: {
                "200": { description: "Avatar updated successfully" },
                "400": { description: "Validation error" },
                "404": { description: "Avatar not found" },
                "500": { description: "Server error" }
            }
        }
    };

    swaggerData.paths['/admin/store/delete/{id}'] = {
        delete: {
            tags: ["Admin Store"],
            summary: "Delete Store Item",
            description: "Delete an existing avatar",
            security: [{ bearerAuth: [] }],
            parameters: [
                { in: "path", name: "id", required: true, schema: { type: "string" }, description: "Avatar ID" }
            ],
            responses: {
                "200": { description: "Avatar deleted successfully" },
                "404": { description: "Avatar not found" },
                "500": { description: "Server error" }
            }
        }
    };

    fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2), 'utf8');
    console.log("Successfully updated Merchant-Dashboard/swagger.json");
} catch (error) {
    console.error("Error updating swagger.json:", error);
}

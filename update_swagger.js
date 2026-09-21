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
                                isNew: { type: "boolean", example: true },
                                spCaptureTimeSec: { type: "number", example: 30 },
                                spShieldDurationMin: { type: "number", example: 60 }
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
                                isNew: { type: "boolean" },
                                spCaptureTimeSec: { type: "number" },
                                spShieldDurationMin: { type: "number" }
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

    
    swaggerData.paths['/user/agree-safety'] = {
        post: {
            tags: ["User Profile"],
            summary: "Agree Safety Warning",
            description: "Set agreedToSafetyWarning to true for a trip, live event, or coin rush event",
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["trip", "event", "coin_rush"], example: "trip" },
                                id: { type: "string", example: "uuid-of-trip-or-event" },
                                agreedToSafetyWarning: { type: "boolean", example: true }
                            },
                            required: ["type", "id"]
                        }
                    }
                }
            },
            responses: {
                "200": { description: "Safety warning agreed successfully" },
                "400": { description: "Validation error" },
                "404": { description: "Trip or Event not found" },
                "500": { description: "Server error" }
            }
        }
    };

    swaggerData.paths['/user/avatars'] = {
        get: {
            tags: ["User Profile"],
            summary: "Get all avatars and their lock status based on user level",
            security: [{ bearerAuth: [] }],
            responses: {
                "200": {
                    description: "Avatars fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { type: "boolean", example: true },
                                    msg: { type: "string", example: "Avatars fetched successfully" },
                                    currentLevel: { type: "integer", example: 5 },
                                    avatars: {
                                        type: "object",
                                        additionalProperties: {
                                            type: "object",
                                            properties: {
                                                front: { type: "string", example: "https://example.com/front.png" },
                                                back: { type: "string", example: "https://example.com/back.png" },
                                                locked: { type: "boolean", example: false },
                                                spCaptureTimeSec: { type: "number", example: 30 },
                                                spShieldDurationMin: { type: "number", example: 60 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "401": { description: "Unauthorized" },
                "500": { description: "Internal server error" }
            }
        }
    };



    
    swaggerData.paths['/rewards/all'] = {
        get: {
            tags: ['Rewards'],
            summary: 'Get All User Rewards',
            description: 'Fetch all user rewards across Surprise Me, Route Stops, Mystery Boxes, Live Events, Coin Rush events, and Merchant Ads.',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'type',
                    in: 'query',
                    required: false,
                    schema: { type: 'string', enum: ['all', 'boxes', 'liveEvents', 'coinRushes', 'merchantAds'] },
                    description: 'Filter rewards by category (e.g. boxes, liveEvents, coinRushes, merchantAds)'
                },
                {
                    name: 'source',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Filter box collections by specific source (e.g., surprise_box, route_stop)'
                }
            ],
            responses: {
                '200': {
                    description: 'Rewards fetched successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'boolean', example: true },
                                    msg: { type: 'string', example: 'Rewards fetched successfully' },
                                    details: {
                                        type: 'object',
                                        properties: {
                                            boxes: { type: 'array', items: { type: 'object' } },
                                            events: { type: 'array', items: { type: 'object' } },
                                            merchantAds: { type: 'array', items: { type: 'object' } }
                                        }
                                    }
                                }
                            },
                            example: {
                                status: true,
                                msg: 'Rewards fetched successfully',
                                details: {
                                    boxes: [
                                        {
                                            id: '84fa681b-3ab1-4fab-ae49-94c014d660e2',
                                            userId: 'e4abf66a-a5ce-48ae-827a-fe814cc525c6',
                                            boxType: 'green',
                                            xpEarned: 50,
                                            distanceCoveredKm: 0,
                                            source: 'route_stop',
                                            lat: 25.2628,
                                            lng: 55.3288,
                                            createdAt: '2026-07-05T18:47:29.526Z',
                                            adData: {
                                                id: '40f32ef5-9b24-4311-86e1-36dd2f3de46a',
                                                adTitle: '1+1 Drinks Special',
                                                imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvqOhRuRlkj8hrkWewpf1RtjXmZaCKYEWkwqnUW_qBIA&s=10',
                                                merchantName: 'Starbucks'
                                            },
                                            isClaimed: false
                                        }
                                    ],
                                    events: [
                                        {
                                            id: 'da51ef2e-2416-43ef-add5-5462dfd30df2',
                                            eventId: 'b2b6237c-8710-4da0-b87f-3d639dbd2e14',
                                            userId: 'e4abf66a-a5ce-48ae-827a-fe814cc525c6',
                                            code: '57B4B0FB',
                                            isRedeemed: true,
                                            redeemedAt: '2026-07-24T20:47:51.244Z',
                                            claimedAt: '2026-07-24T20:47:16.683Z',
                                            xpEarned: 232,
                                            lat: 33.5650926,
                                            lng: 73.1519571,
                                            isCoinRush: false,
                                            event: {
                                                id: 'b2b6237c-8710-4da0-b87f-3d639dbd2e14',
                                                title: 'tetsyumcd',
                                                description: 'casd ',
                                                address: '2 Soan Ave, Soan Gardens Block B Islamabad, Pakistan',
                                                merchantId: '74c46e56-6df8-41b0-b873-5d2fd80d6464',
                                                reward: 'Burger as a reward',
                                                rewardQuantity: 3,
                                                remainingQty: 2,
                                                status: 'completed',
                                                xpReward: 232
                                            }
                                        },
                                        {
                                            id: 'a821af58-d29c-4418-9f4f-6f433255c84d',
                                            eventId: '15d37906-ad5a-4fdc-ba84-201973fc346c',
                                            userId: 'e4abf66a-a5ce-48ae-827a-fe814cc525c6',
                                            code: 'CLAIM-96BFEB6C-1864',
                                            isRedeemed: true,
                                            redeemedAt: '2026-07-26T21:07:09.662Z',
                                            claimedAt: '2026-07-26T21:06:21.866Z',
                                            isCoinRush: true,
                                            event: {
                                                id: '15d37906-ad5a-4fdc-ba84-201973fc346c',
                                                title: 'monal 4 mall event ',
                                                description: 'monal 4 mall event ',
                                                rewardType: 'PHYSICAL',
                                                rewardTitle: 'Hundred Dollars Reward',
                                                rewardValue: 233
                                            }
                                        }
                                    ],
                                    merchantAds: [
                                        {
                                            id: 'b5668e6d-1b06-49fb-baeb-4ba3fa9c2f2a',
                                            adId: '40f32ef5-9b24-4311-86e1-36dd2f3de46a',
                                            userId: 'e4abf66a-a5ce-48ae-827a-fe814cc525c6',
                                            createdAt: '2026-06-27T15:48:54.513Z',
                                            ad: {
                                                id: '40f32ef5-9b24-4311-86e1-36dd2f3de46a',
                                                adTitle: '1+1 Drinks Special',
                                                mysteryBoxReward: 'Free Signature Smoothie'
                                            },
                                            code: {
                                                code: 'B91591AD',
                                                isClaimed: true,
                                                isRedeemed: false
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    
    swaggerData.paths['/rewards/detail/{id}'] = {
        get: {
            tags: ['Rewards'],
            summary: 'Get Single Reward Details',
            description: 'Fetch complete details for any reward by ID (Box, Live Event claim, Coin Rush claim, or Merchant Ad claim). Automatically checks all reward categories and returns all redemption codes, claim status, and attached event/ad details.',
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: 'id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    description: 'Reward ID (Claim ID or Box Collection ID)'
                }
            ],
            responses: {
                '200': {
                    description: 'Reward details fetched successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'boolean', example: true },
                                    msg: { type: 'string', example: 'Reward details fetched successfully' },
                                    category: { type: 'string', example: 'live_event' },
                                    rewardType: { type: 'string', example: 'live_event' },
                                    reward: { type: 'object' }
                                }
                            },
                            example: {
                                status: true,
                                msg: "Reward details fetched successfully",
                                category: "live_event",
                                rewardType: "live_event",
                                reward: {
                                    id: "da51ef2e-2416-43ef-add5-5462dfd30df2",
                                    eventId: "b2b6237c-8710-4da0-b87f-3d639dbd2e14",
                                    userId: "e4abf66a-a5ce-48ae-827a-fe814cc525c6",
                                    code: "57B4B0FB",
                                    isRedeemed: true,
                                    redeemedAt: "2026-07-24T20:47:51.244Z",
                                    claimedAt: "2026-07-24T20:47:16.683Z",
                                    xpEarned: 232,
                                    lat: 33.5650926,
                                    lng: 73.15195709999999,
                                    event: {
                                        id: "b2b6237c-8710-4da0-b87f-3d639dbd2e14",
                                        title: "tetsyumcd",
                                        description: "casd ",
                                        address: "2 Soan Ave, Soan Gardens Block B Islamabad, Pakistan",
                                        merchantId: "74c46e56-6df8-41b0-b873-5d2fd80d6464",
                                        commanderAvatar: "",
                                        imageUrl: "https://hel1.your-objectstorage.com/raidr-assets/eventReward/1784925796421_images.jpg",
                                        latitude: 33.5650926,
                                        longitude: 73.15195709999999,
                                        startTime: "2026-07-24T20:45:00.000Z",
                                        endTime: "2026-07-25T19:00:00.000Z",
                                        reward: "Burger as a reward",
                                        rewardQuantity: 3,
                                        remainingQty: 2,
                                        status: "completed",
                                        xpReward: 232,
                                        size: "small",
                                        qrCode: "event-qr-998dfabbde786c6d0a2bb20172f184fd",
                                        createdAt: "2026-07-24T20:43:20.472Z",
                                        updatedAt: "2026-07-25T19:00:34.329Z"
                                    }
                                }
                            }
                        }
                    }
                },
                '404': { description: 'Reward not found' }
            }
        }
    };

    swaggerData.paths['/review/add'] = {
        post: {
            tags: ["Review"],
            summary: "Add a new review",
            description: "Submit a rating and comment.",
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                rating: { type: "integer", example: 5 },
                                comment: { type: "string", example: "Great experience!" }
                            },
                            required: ["rating"]
                        }
                    }
                }
            },
            responses: {
                "200": { description: "Review submitted successfully" },
                "400": { description: "Rating is required" },
                "500": { description: "Internal server error" }
            }
        }
    };

    swaggerData.paths['/user/coin-rush/complete-checkpoint/{eventId}'] = {
        post: {
            tags: ["Coin Rush"],
            summary: "Complete Coin Rush Checkpoint",
            description: "Submit a checkpoint completion via GPS coordinates, QR code, Q&A, or Photo.",
            security: [{ bearerAuth: [] }],
            parameters: [
                { in: "path", name: "eventId", required: true, schema: { type: "string" }, description: "Event ID" }
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                checkpointId: { type: "string", example: "uuid-of-checkpoint" },
                                lat: { type: "number", example: 40.7128 },
                                lng: { type: "number", example: -74.0060 },
                                qrCode: { type: "string", example: "qr-code-string" },
                                answer: { type: "string", example: "Blue" },
                                secretCode: { type: "string", example: "12345" },
                                photoUrl: { type: "string", example: "https://example.com/photo.jpg" }
                            }
                        }
                    }
                }
            },
            responses: {
                "200": { 
                    description: "Checkpoint completed successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { type: "boolean", example: true },
                                    msg: { type: "string", example: "Congratulations! You finished in 1st place and won a prize!" },
                                    completedAll: { type: "boolean", example: true },
                                    isWinner: { type: "boolean", example: true },
                                    claimId: { type: "string", example: "uuid-of-claim" },
                                    claimCode: { type: "string", example: "CLAIM-XYZ-1234" },
                                    prizePosition: { type: "integer", example: 1 },
                                    progress: { type: "string", example: "5/5" },
                                    isAchieved: { type: "boolean", example: true },
                                    xpEarned: { type: "integer", example: 50 },
                                    nextCheckpoint: { type: "object", nullable: true }
                                }
                            }
                        }
                    }
                },
                "400": { 
                    description: "Validation error or out of range",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { type: "boolean", example: false },
                                    msg: { type: "string", example: "You are not within range." }
                                }
                            }
                        }
                    }
                },
                "404": { 
                    description: "Event or checkpoint not found",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { type: "boolean", example: false },
                                    msg: { type: "string", example: "Event not found" }
                                }
                            }
                        }
                    }
                },
                "500": { description: "Server error" }
            }
        }
    };

    fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2), 'utf8');
    console.log("Successfully updated Merchant-Dashboard/swagger.json");
} catch (error) {
    console.error("Error updating swagger.json:", error);
}

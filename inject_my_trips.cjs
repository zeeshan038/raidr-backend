const fs = require('fs');

const swaggerPath = './swagger.json';
const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const newExample = {
    "status": true,
    "msg": "My trips fetched successfully",
    "trips": [
        {
            "id": "c9bde0e6-ddca-4053-9aac-ee9b89ceee47",
            "userId": "e4abf66a-a5ce-48ae-827a-fe814cc525c6",
            "ownerUid": null,
            "routeTitle": "My Awesome Summer Trip",
            "destination": "Dubai, UAE",
            "hotelLocation": "Burj Al Arab, Dubai",
            "tripDates": [
                "2026-06-20T00:00:00.000Z",
                "2026-06-21T00:00:00.000Z",
                "2026-06-22T00:00:00.000Z"
            ],
            "status": "upcoming",
            "tripPace": false,
            "radiusKm": 15,
            "travelWith": "Family",
            "interestedVibes": [
                "Culinary",
                "Nature",
                "Culture"
            ],
            "imageUrls": [
                "https://example.com/dubai-image1.jpg",
                "https://example.com/dubai-image2.jpg"
            ],
            "routesByDate": {
                "2026-05-17": [
                    {
                        "lat": 29.5498256,
                        "lng": 34.9594078,
                        "name": "Yaniv Fireball",
                        "index": 1,
                        "visible": true,
                        "category": "Amusement Park"
                    },
                    {
                        "lat": 29.5495106,
                        "lng": 34.9590798,
                        "name": "מתקן כדור האש",
                        "index": 2,
                        "visible": true,
                        "category": "Amusement park"
                    }
                ],
                "2026-05-18": [
                    {
                        "lat": 29.5538277,
                        "lng": 34.9619612,
                        "name": "The Booster",
                        "index": 1,
                        "visible": true,
                        "category": "Amusement Park"
                    }
                ]
            },
            "isShared": false,
            "inviteToken": null,
            "currentLatitude": 25.2608,
            "currentLongitude": 55.3268,
            "lastLocationUpdatedAt": "2026-06-18T04:56:40.034Z",
            "heading": 90,
            "navStatus": "navigating",
            "flowKind": null,
            "generatedStartLat": null,
            "generatedStartLng": null,
            "generatedDestLat": null,
            "generatedDestLng": null,
            "createdAt": "2026-06-17T15:52:19.894Z",
            "updatedAt": "2026-06-19T10:45:30.512Z"
        },
        {
            "id": "74b08c3e-b24a-4435-8361-5f8252dbf4f4",
            "userId": "e4abf66a-a5ce-48ae-827a-fe814cc525c6",
            "ownerUid": null,
            "routeTitle": "swabi shiekh jana",
            "destination": "Dubai, UAE",
            "hotelLocation": "Burj Al Arab, Dubai",
            "tripDates": [
                "2026-06-20T00:00:00.000Z",
                "2026-06-21T00:00:00.000Z",
                "2026-06-22T00:00:00.000Z"
            ],
            "status": "upcoming",
            "tripPace": false,
            "radiusKm": 15,
            "travelWith": "Family",
            "interestedVibes": [
                "Culinary",
                "Nature",
                "Culture"
            ],
            "imageUrls": [
                "https://example.com/dubai-image1.jpg",
                "https://example.com/dubai-image2.jpg"
            ],
            "routesByDate": null,
            "isShared": false,
            "inviteToken": null,
            "currentLatitude": null,
            "currentLongitude": null,
            "lastLocationUpdatedAt": null,
            "heading": null,
            "navStatus": null,
            "flowKind": null,
            "generatedStartLat": null,
            "generatedStartLng": null,
            "generatedDestLat": null,
            "generatedDestLng": null,
            "createdAt": "2026-06-17T15:44:32.032Z",
            "updatedAt": "2026-06-17T15:44:55.607Z"
        }
    ]
};

if (swaggerDoc.paths["/trip/get-my-trips"] && swaggerDoc.paths["/trip/get-my-trips"].get.responses["200"]) {
    // We already moved examples into schema.example earlier
    swaggerDoc.paths["/trip/get-my-trips"].get.responses["200"].content["application/json"].schema.example = newExample;
}

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerDoc, null, 2), 'utf8');
console.log('Successfully updated get-my-trips example!');

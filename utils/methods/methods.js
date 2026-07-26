import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    return jwt.sign({ user }, process.env.JWT_SECRET);
};

export const generateOTP = async () => {
    const OTP = Math.floor(100000 + Math.random() * 900000);
    return OTP.toString();
};

export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; 
}


export const generateDynamicXP = (isSurprise) => {
    if (isSurprise) {
        return Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    } else {
        return Math.floor(Math.random() * (60 - 20 + 1)) + 20;
    }
};

export const calculateRadiusForUserLiveEvent = (users, eventLat, eventLng, radiusKm = 20) => {
    return users.filter(user => {
        if (!user.lat || !user.long) return false;
        
        const userLat = parseFloat(user.lat);
        const userLng = parseFloat(user.long);
        
        if (isNaN(userLat) || isNaN(userLng)) return false;

        const distanceMeters = haversineDistance(eventLat, eventLng, userLat, userLng);
        return distanceMeters <= (radiusKm * 1000);
    });
};


// Helper to generate random coordinates within a radius (in meters)
export const generateRandomCoordinates = (centerLat, centerLng, radiusMeter, count) => {
    const checkpoints = [];
    const R = 6378137; // Earth radius in meters
    for (let i = 1; i <= count; i++) {
        // Random distance and bearing
        const r = Math.random() * radiusMeter;
        const theta = Math.random() * 2 * Math.PI;

        const dLat = (r * Math.cos(theta)) / R;
        const dLng = (r * Math.sin(theta)) / (R * Math.cos((centerLat * Math.PI) / 180));

        const checkpointLat = centerLat + dLat * (180 / Math.PI);
        const checkpointLng = centerLng + dLng * (180 / Math.PI);

        checkpoints.push({
            sequence: i,
            latitude: checkpointLat,
            longitude: checkpointLng,
            description: `Checkpoint ${i}`
        });
    }
    return checkpoints;
};
import { generateRandomCoordinates } from './utils/methods/methods.js';

async function runTest() {
    // Coordinate for Shalimar Gardens, Lahore (A well-defined public park)
    const lat = 31.5862;
    const lng = 74.3820;
    const radius = 200; // 200 meters search radius
    const count = 5;

    console.log(`\n=== Testing Auto-Generation inside Boundaries ===`);
    console.log(`Center Location: ${lat}, ${lng} (Shalimar Gardens)`);
    console.log(`Radius: ${radius}m, Checkpoint Count: ${count}`);
    console.log(`Fetching bounds from OpenStreetMap Overpass and scattering points...\n`);

    try {
        const checkpoints = await generateRandomCoordinates(lat, lng, radius, count);
        console.log(`Successfully generated ${checkpoints.length} checkpoints:`);
        console.dir(checkpoints, { depth: null });
        console.log(`\n=== Verification Complete ===\n`);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();

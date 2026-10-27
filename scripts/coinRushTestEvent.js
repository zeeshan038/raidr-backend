/**
 * List Coin Rush events or seed a GPS test event (20 m checkpoint testing).
 *
 * Usage:
 *   node scripts/coinRushTestEvent.js list
 *   node scripts/coinRushTestEvent.js create [--live] [--merchant-id=UUID] [--lat=33.565] [--lng=73.149]
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

function parseArgs(argv) {
    const cmd = argv[2] || 'list';
    const flags = {};
    for (const arg of argv.slice(3)) {
        if (arg.startsWith('--')) {
            const [key, val] = arg.slice(2).split('=');
            flags[key] = val === undefined ? true : val;
        }
    }
    return { cmd, flags };
}

/** ~meters north/south offset in degrees latitude */
function offsetLatMeters(lat, meters) {
    return lat + meters / 111_320;
}

async function listEvents() {
    const events = await prisma.coinRushEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
            checkpoints: { orderBy: { sequence: 'asc' } },
            merchant: { select: { id: true, businessName: true } },
            _count: { select: { participants: true } },
        },
    });

    if (events.length === 0) {
        console.log('No Coin Rush events in database.');
        return;
    }

    console.log('\nCoin Rush events (newest first):\n');
    for (const e of events) {
        const gpsCp = e.checkpoints.filter((c) => c.type === 'GPS' && c.latitude != null);
        console.log(`• ${e.title}`);
        console.log(`  id:     ${e.id}`);
        console.log(`  status: ${e.status} | type: ${e.eventType} | checkpoints: ${e.checkpointCount} | joined: ${e._count.participants}`);
        console.log(`  merchant: ${e.merchant?.businessName ?? e.merchantId}`);
        if (gpsCp.length) {
            for (const c of gpsCp) {
                console.log(
                    `  GPS cp #${c.sequence}: ${c.id} @ ${c.latitude}, ${c.longitude} — "${c.description}"`
                );
            }
        } else {
            console.log('  (no GPS checkpoints — use create for pure GPS 20 m testing)');
        }
        console.log('');
    }

    const live = events.find((e) => e.status === 'live');
    if (live) {
        console.log('Suggested for manual API testing (live):');
        console.log(`  EVENT_ID=${live.id}`);
        const first = live.checkpoints[0];
        if (first) {
            console.log(`  First checkpoint: ${first.id} (seq ${first.sequence}, type ${first.type})`);
        }
    }
}

async function resolveMerchantId(flags) {
    if (flags['merchant-id']) {
        return flags['merchant-id'];
    }
    const merchant = await prisma.merchant.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true, businessName: true },
    });
    if (!merchant) {
        throw new Error('No merchant in DB. Pass --merchant-id=UUID');
    }
    console.log(`Using merchant: ${merchant.businessName} (${merchant.id})`);
    return merchant.id;
}

async function createGpsTestEvent(flags) {
    const merchantId = await resolveMerchantId(flags);
    const baseLat = parseFloat(flags.lat ?? '33.565128');
    const baseLng = parseFloat(flags.lng ?? '73.149235');
    const setLive = Boolean(flags.live);
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const checkpoints = [
        {
            sequence: 1,
            type: 'GPS',
            latitude: baseLat,
            longitude: baseLng,
            description: 'TEST CP1: Stand at the first pin (within 20 m to complete).',
            xp: 75,
        },
        {
            sequence: 2,
            type: 'GPS',
            latitude: offsetLatMeters(baseLat, 80),
            longitude: baseLng,
            description: 'TEST CP2: Walk ~80 m north to the second pin.',
            xp: 75,
        },
        {
            sequence: 3,
            type: 'GPS',
            latitude: offsetLatMeters(baseLat, 160),
            longitude: baseLng,
            description: 'TEST CP3: Finish at the third pin.',
            xp: 75,
        },
    ];

    const event = await prisma.coinRushEvent.create({
        data: {
            title: `GPS radius test ${now.toISOString().slice(0, 16)}`,
            description: 'Auto-created for 20 m checkpoint + instruction API testing. Safe to delete.',
            merchantId,
            eventType: 'GPS',
            status: setLive ? 'live' : 'scheduled',
            checkpointCount: checkpoints.length,
            duration: 120,
            startTime: now,
            endTime: end,
            centerLat: baseLat,
            centerLng: baseLng,
            radiusMeter: 500,
            rewardType: 'DIGITAL_COUPON',
            rewardTitle: 'Test reward',
            rewardImageUrl: '',
            rewardDescription: 'Test',
            rewardClaimInstructions: 'Test',
            rewardValue: 0,
            winnersCount: 3,
            checkpoints: { create: checkpoints },
        },
        include: { checkpoints: { orderBy: { sequence: 'asc' } } },
    });

    console.log('\nCreated GPS Coin Rush test event:\n');
    console.log(`  EVENT_ID=${event.id}`);
    console.log(`  status: ${event.status} (pass --live to set live on create)`);
    console.log('\nCheckpoints:');
    for (const c of event.checkpoints) {
        console.log(`  #${c.sequence} ${c.id}`);
        console.log(`    lat/lng: ${c.latitude}, ${c.longitude}`);
        console.log(`    instruction: ${c.description}`);
    }

    const cp1 = event.checkpoints[0];
    console.log('\nSample requests (replace TOKEN with user JWT):\n');
    console.log(`curl -s "http://localhost:5001/api/coin-rush/details/${event.id}" -H "Authorization: Bearer TOKEN"`);
    console.log(`curl -s -X POST "http://localhost:5001/api/coin-rush/join/${event.id}" -H "Authorization: Bearer TOKEN"`);
    console.log(
        `curl -s -X POST "http://localhost:5001/api/coin-rush/complete-checkpoint/${event.id}" \\\n` +
            `  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \\\n` +
            `  -d '{"checkpointId":"${cp1.id}","lat":${cp1.latitude},"lng":${cp1.longitude}}'`
    );
    console.log(
        `\nOut of range (~25 m north): lat ${offsetLatMeters(cp1.latitude, 25)}, lng ${cp1.longitude}`
    );
}

async function main() {
    const { cmd, flags } = parseArgs(process.argv);
    try {
        if (cmd === 'list') {
            await listEvents();
        } else if (cmd === 'create') {
            await createGpsTestEvent(flags);
        } else {
            console.error(`Unknown command: ${cmd}. Use: list | create`);
            process.exit(1);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

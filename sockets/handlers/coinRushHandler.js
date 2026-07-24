import { prisma } from '../../config/db.js';

/**
 * Subscribe the connected socket to the Coin Rush event topic and
 * immediately send back the current event snapshot so the mobile app
 * has the baseline status immediately.
 * 
 * @param {import('uWebSockets.js').WebSocket} ws - the connected socket
 * @param {object} payload - parsed incoming message
 * @param {string} payload.eventId
 */
export const handleJoinCoinRushRoom = async (ws, payload) => {
    const { eventId } = payload;

    if (!eventId) {
        ws.send(JSON.stringify({
            type: 'error',
            msg: 'eventId is required to join a coin rush room'
        }));
        return;
    }

    const topic = `coinrush:${eventId}`;

    // Subscribe this socket to the event topic (uWS Pub/Sub)
    ws.subscribe(topic);

    console.log(`[CoinRushHandler] User ${ws.userId} subscribed to ${topic}`);

    try {
        const event = await prisma.coinRushEvent.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                title: true,
                status: true,
                checkpointCount: true,
                endTime: true,
                _count: {
                    select: { participants: true }
                }
            }
        });

        if (!event) {
            ws.send(JSON.stringify({
                type: 'error',
                msg: 'Coin Rush event not found'
            }));
            return;
        }

        ws.send(JSON.stringify({
            type: 'coinrush_event_snapshot',
            eventId: event.id,
            title: event.title,
            status: event.status,
            checkpointCount: event.checkpointCount,
            totalParticipants: event._count.participants,
            endTime: event.endTime
        }));

    } catch (err) {
        console.error('[CoinRushHandler] Failed to fetch event snapshot:', err.message);
        ws.send(JSON.stringify({
            type: 'error',
            msg: 'Failed to load event data'
        }));
    }
};

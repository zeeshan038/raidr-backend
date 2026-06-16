

/**
 * @Description This function is used to rank the locations based on the user's preferences.
 @ @type Function
 * @input candidates - Array
 * @returns response - Array
 */
export async function rankLocationsWithAI({
    candidates,
    userTags,
    intenseMode,
    rankedResultCap = 20,
    planMultiVibeDiversity = false,
}) {
    const visibleCount = intenseMode ? 6 : 3;
    if (!candidates || candidates.length === 0) return [];

    const systemPrompt = `You are a local travel expert. Rank the provided locations to build an amazing itinerary based on these vibes: ${userTags.join(', ')}. 
                          The user prefers a ${intenseMode ? 'fast-paced, intense' : 'relaxed'} trip.
                          ${planMultiVibeDiversity ? 'Ensure there is a diverse mix of vibes in the top recommendations.' : ''}

                          CRITICAL INSTRUCTION: Return a JSON object with an array of indices representing the new order.
                          Example: {"order": [2, 0, 5, 1, 3, 4]}`;

    const userMessage = JSON.stringify({
        user_vibes: userTags,
        mode: intenseMode ? "intense" : "relax",
        candidates: candidates.map((c, i) => ({
            index: i,
            name: c.name,
            category: c.category
        }))
    });

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0.45,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await res.json();

        if (data.choices && data.choices.length > 0) {
            const aiResponse = JSON.parse(data.choices[0].message.content);
            const order = aiResponse.order;

            if (Array.isArray(order)) {
                // Apply the order
                const ranked = [];
                const addedIndices = new Set();

                for (const idx of order) {
                    if (candidates[idx] && !addedIndices.has(idx)) {
                        ranked.push(candidates[idx]);
                        addedIndices.add(idx);
                    }
                }

                // Add any missing items to the bottom
                for (let i = 0; i < candidates.length; i++) {
                    if (!addedIndices.has(i)) {
                        ranked.push(candidates[i]);
                    }
                }

                return ranked.slice(0, rankedResultCap);
            }
        }
    } catch (error) {
        console.error("OpenAI Ranking Error:", error);
    }

    // Fallback: Return original order if AI fails
    return candidates.slice(0, rankedResultCap);
}

export async function rankPlanCandidatesChunked(rawCandidates, keywordTags, multiVibePlan, intenseMode = false) {
    const chunkSize = 28;
    const futures = [];

    for (let i = 0; i < rawCandidates.length; i += chunkSize) {
        const chunk = rawCandidates.slice(i, Math.min(i + chunkSize, rawCandidates.length));
        futures.push(rankLocationsWithAI({
            candidates: chunk,
            userTags: keywordTags,
            intenseMode,
            rankedResultCap: chunk.length,
            planMultiVibeDiversity: multiVibePlan,
        }));
    }

    const parts = await Promise.all(futures);
    return parts.flat();
}



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


const LANGUAGE_NAMES = {
  en: 'English', he: 'Hebrew', es: 'Spanish',
  de: 'German', ru: 'Russian', ar: 'Arabic',
};

function outputLanguageInstruction(code) {
  const lang = (code || 'en').toLowerCase().split(/[-_]/)[0];
  const name = LANGUAGE_NAMES[lang];
  if (name) {
    return `Output language: ${name} ONLY. Every string in the JSON array must be written entirely in ${name}.
Do not mix languages. Do not include English (unless the target is English).`;
  }
  return `Output language: use the primary language for BCP-47 locale "${code}".
Write every string in that language only; do not mix in English unless it is the target language.`;
}

export async function generateCityVibeSuggestions({ city, country, interestedVibes = [], languageCode = 'en' }) {
  const prompt = `
Generate 3 creative lifestyle suggestions.

Context:
City: ${city}
Country: ${country}
Interests: ${interestedVibes.join(', ')}

${outputLanguageInstruction(languageCode)}

Rules:
- Return EXACTLY 3 results
- Each result must be 1 lines
- Mix city atmosphere + local culture + interests
- Response MUST be a JSON array of strings
- No explanation text

Example format:
["line1 \\n line2", "line1 \\n line2", "line1 \\n line2"]
`.trim();

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
            temperature: 0.8,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
        })
    });

    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
        let content = data.choices[0].message.content.trim();
        // Strip markdown code blocks if any
        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (content.startsWith('\`\`\`')) {
            content = content.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }
        return JSON.parse(content);
    }
  } catch (error) {
    console.error("generateCityVibeSuggestions error:", error);
  }

  // Fallback
  const interests = interestedVibes.slice(0, 3).join(', ');
  const ctx = interests ? ` — ${interests}` : '';
  return [
    `Explore ${city} with local flair${ctx}.`,
    `Blend neighborhoods, flavors, and pace that fit you.`,
    `Your creative route is almost ready — enjoy ${country}.`,
  ];
}

export async function generateLoadingTexts({ userVibes = [], languageCode = 'en' }) {
  const prompt = `
User interests: ${userVibes.join(', ')}

${outputLanguageInstruction(languageCode)}

Generate 10 short, friendly loading screen messages.
Each message must be:
- 1 line only
- Under 6 words (or short equivalent in the output language)
- Travel / route related
- Casual & positive

Return ONLY a JSON array of strings.
Example:
[
  "Finding cozy cafes...",
  "Matching your vibe...",
  "Building scenic routes...",
  "Almost ready..."
]
`.trim();

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            temperature: 0.6,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 120,
        })
    });

    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (content.startsWith('\`\`\`')) {
            content = content.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }
        return JSON.parse(content);
    }
  } catch (error) {
    console.error("generateLoadingTexts error:", error);
  }

  // Fallback
  return [
    'Preparing your trip...', 
    'Finding best routes...', 
    'Matching your vibe...', 
    'Almost ready...'
  ];
}

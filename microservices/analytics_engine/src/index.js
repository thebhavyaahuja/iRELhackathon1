// In a production environment, this would be a connection to a persistent database (e.g., PostgreSQL, MongoDB, Elasticsearch).
// For this example, we'll use an in-memory store.
const analyticsDataStore = {
    events: [], // Stores enriched mention objects
};

// --- Helper Functions ---

// Helper to get the start of a day, week, or month for a given date
const getStartOfPeriod = (date, periodType) => {
    const d = new Date(date);
    if (periodType === 'day') {
        d.setHours(0, 0, 0, 0);
        return d;
    } else if (periodType === 'week') {
        const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday as start of week
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    } else if (periodType === 'month') {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    return d; // Should not happen with valid periodType
};

// Helper to filter events by brand and time period
const filterEvents = (brand, period, referenceDate = new Date()) => {
    const endDate = new Date(referenceDate);
    let startDate = new Date(referenceDate);

    if (period === 'daily') {
        startDate.setDate(endDate.getDate() - 1);
    } else if (period === 'weekly') {
        startDate.setDate(endDate.getDate() - 7);
    } else if (period === 'monthly') {
        startDate.setMonth(endDate.getMonth() - 1);
    } else { // Default to all time for the brand if period is not recognized for filtering range
        return analyticsDataStore.events.filter(event => (event.brand || 'default') === brand);
    }
    
    return analyticsDataStore.events.filter(event => {
        const eventDate = new Date(event.createdAt);
        return (event.brand || 'default') === brand && eventDate >= startDate && eventDate <= endDate;
    });
};

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must', 'i', 'me', 'my', 'myself', 'we', 'us',
    'our', 'ourselves', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they',
    'them', 'their', 'theirs', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'at', 'by', 'for', 'from', 'in', 'into', 'on', 'onto', 'of', 'over',
    'to', 'under', 'up', 'with', 'and', 'but', 'or', 'so', 'if', 'because', 'as', 'until', 'while', 'of', 'at',
    'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'rt', // common twitter noise
    // Add more common words and social media specific noise if needed
]);


// --- Exported Functions ---

export const recordMentionEvent = async (eventData) => {
    if (!eventData || !eventData.tweetId || !eventData.createdAt || !eventData.brand) {
        return { success: false, error: "Invalid eventData: tweetId, createdAt, and brand are required." };
    }
    // Ensure createdAt is a valid date; if not, use current time as a fallback (might need adjustment based on strictness)
    try {
        new Date(eventData.createdAt).toISOString();
    } catch (e) {
        return { success: false, error: "Invalid eventData: createdAt is not a valid ISO date string." };
    }

    analyticsDataStore.events.push({ ...eventData });
    return { success: true, eventId: eventData.tweetId };
};

export const getSentimentTrends = async ({ period = 'daily', brand = 'default' }) => {
    const relevantEvents = filterEvents(brand, period);
    const trends = {}; // Key: periodStartDate (ISO string), Value: { positive, negative, neutral }

    relevantEvents.forEach(event => {
        const periodMap = { 'daily': 'day', 'weekly': 'week', 'monthly': 'month' };
        const periodType = periodMap[period] || 'day';
        const pStart = getStartOfPeriod(event.createdAt, periodType).toISOString();

        if (!trends[pStart]) {
            trends[pStart] = { positive: 0, negative: 0, neutral: 0 };
        }
        if (event.sentiment === 'positive') trends[pStart].positive++;
        else if (event.sentiment === 'negative') trends[pStart].negative++;
        else if (event.sentiment === 'neutral') trends[pStart].neutral++;
    });

    return Object.entries(trends).map(([date, counts]) => ({
        date,
        brand,
        ...counts
    })).sort((a,b) => new Date(a.date) - new Date(b.date)); // Sort by date
};

export const getVolumeByDimension = async ({ dimension = 'sentiment', period = 'weekly', brand = 'default' }) => {
    const relevantEvents = filterEvents(brand, period);
    const volumes = {}; // Key: dimensionValue (e.g., "positive", "question"), Value: count

    relevantEvents.forEach(event => {
        const key = event[dimension]; // e.g., event.sentiment or event.intent
        if (key) {
            volumes[key] = (volumes[key] || 0) + 1;
        }
    });

    return Object.entries(volumes).map(([value, count]) => ({
        [dimension]: value,
        count,
        brand
    }));
};

export const identifyEmergingTopics = async ({ period = 'weekly', brand = 'default' }) => {
    const relevantEvents = filterEvents(brand, period);
    const keywordFrequencies = {}; // { keyword: { count: N, sentiments: {positive: N, negative: N, neutral: N} } }

    relevantEvents.forEach(event => {
        if (event.tweetText && typeof event.tweetText === 'string') {
            const words = event.tweetText.toLowerCase().replace(/[.,!?;:"'()`]/g, '').split(/\s+/);
            const eventSentiment = event.sentiment || 'neutral';

            words.forEach(word => {
                if (word.length > 2 && !STOP_WORDS.has(word) && !word.startsWith('@') && !word.startsWith('#') && !word.startsWith('http')) {
                    if (!keywordFrequencies[word]) {
                        keywordFrequencies[word] = { count: 0, sentiments: { positive: 0, negative: 0, neutral: 0 } };
                    }
                    keywordFrequencies[word].count++;
                    keywordFrequencies[word].sentiments[eventSentiment]++;
                }
            });
        }
    });

    const sortedTopics = Object.entries(keywordFrequencies)
        .map(([topic, data]) => {
            let dominantSentiment = 'neutral';
            if (data.sentiments.positive > data.sentiments.negative && data.sentiments.positive > data.sentiments.neutral) {
                dominantSentiment = 'positive';
            } else if (data.sentiments.negative > data.sentiments.positive && data.sentiments.negative > data.sentiments.neutral) {
                dominantSentiment = 'negative';
            }
            // For a true "shift", we'd need historical data for the topic. Here we just show current dominant.
            return { topic, mentions: data.count, dominantSentiment, brand, sentimentDetails: data.sentiments };
        })
        .sort((a, b) => b.mentions - a.mentions) // Sort by mention count
        .slice(0, 10); // Return top 10 topics

    // The PRD mentions "sentiment shifts". This is a simplified version showing dominant sentiment.
    // A real implementation would compare current sentiment distribution for a topic against a baseline.
    return sortedTopics.map(t => ({ // Simplify output to match test expectations if needed
        topic: t.topic,
        mentions: t.mentions,
        sentimentShift: t.dominantSentiment, // Simplified: using dominant sentiment as "shift"
        brand: t.brand
    }));
};

export const generateSummaryReport = async ({ period = 'monthly', brand = 'default' }) => {
    const relevantEvents = filterEvents(brand, period);
    
    const totalMentions = relevantEvents.length;
    const sentimentBreakdown = { positive: 0, negative: 0, neutral: 0 };
    const intentBreakdown = {};

    relevantEvents.forEach(event => {
        if (event.sentiment) {
            sentimentBreakdown[event.sentiment] = (sentimentBreakdown[event.sentiment] || 0) + 1;
        }
        if (event.intent) {
            intentBreakdown[event.intent] = (intentBreakdown[event.intent] || 0) + 1;
        }
    });

    // For emerging topics in the report, we can call identifyEmergingTopics or do a simplified version.
    // Let's call the existing function for consistency, but maybe with fewer results for a summary.
    const emergingTopicsRaw = await identifyEmergingTopics({ period, brand });
    const emergingTopicsSummary = emergingTopicsRaw.slice(0, 5).map(t => ({ // Top 5 for summary
        topic: t.topic,
        trend: t.sentimentShift // Using dominant sentiment as trend for simplicity
    }));

    return {
        brand,
        period,
        totalMentions,
        sentimentBreakdown,
        intentBreakdown,
        emergingTopics: emergingTopicsSummary,
        generatedAt: new Date().toISOString()
    };
};

// Function to clear all data (useful for testing or specific reset scenarios)
export const _clearAnalyticsData_TEST_ONLY = () => {
    analyticsDataStore.events = [];
    // console.log("Analytics data cleared for testing.");
};

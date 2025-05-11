import {
    recordMentionEvent,
    getSentimentTrends,
    getVolumeByDimension,
    identifyEmergingTopics,
    generateSummaryReport,
    _clearAnalyticsData_TEST_ONLY
} from "../src/index.js";

describe('Analytics Engine Microservice', () => {
    const sampleMentionData = {
        tweetId: "analyticsTweet123",
        userId: "userAnalytics",
        screenName: "AnalyticsFan",
        name: "Ana Lytics",
        tweetText: "Testing the analytics engine with this mention about a new_feature_X.",
        createdAt: "2025-05-11T10:00:00.000Z",
        favoriteCount: 10,
        retweetCount: 2,
        lang: "en",
        type: "tweet",
        sentiment: "positive",
        urgency: "low",
        intent: "feedback",
        handlingType: "acknowledge_log",
        brand: "TestBrand"
    };

    const sampleMentionData2 = {
        tweetId: "analyticsTweet456",
        userId: "userAnalytics2",
        screenName: "AnalyticsFan2",
        name: "Ana Lytics Jr",
        tweetText: "Another test for TestBrand, this time it is a complaint about service_outage_Y.",
        createdAt: "2025-05-10T12:00:00.000Z",
        favoriteCount: 1,
        retweetCount: 0,
        lang: "en",
        type: "tweet",
        sentiment: "negative",
        urgency: "high",
        intent: "complaint",
        handlingType: "type2_human",
        brand: "TestBrand"
    };

    const sampleMentionDataDifferentBrand = {
        tweetId: "analyticsTweet789",
        userId: "userOther",
        screenName: "OtherBrandFan",
        name: "Other Lytics",
        tweetText: "This is for AnotherBrand, a neutral mention.",
        createdAt: "2025-05-11T01:00:00.000Z", // Changed from T14:00 to ensure it's within "today" if test runs later
        favoriteCount: 3,
        retweetCount: 1,
        lang: "en",
        type: "tweet",
        sentiment: "neutral",
        urgency: "medium",
        intent: "other",
        handlingType: "manual_review",
        brand: "AnotherBrand"
    };

    beforeEach(async () => {
        await _clearAnalyticsData_TEST_ONLY();
    });

    describe('recordMentionEvent', () => {
        it('should successfully record a valid mention event', async () => {
            const result = await recordMentionEvent(sampleMentionData);
            expect(result.success).toBe(true);
            expect(result.eventId).toBe(sampleMentionData.tweetId);
        });

        it('should return an error if eventData is invalid or missing required fields', async () => {
            const result = await recordMentionEvent({ userId: "onlyUser", brand: "TestBrand", createdAt: "2025-01-01T00:00:00.000Z" });
            expect(result.success).toBe(false);
            expect(result.error).toBe("Invalid eventData: tweetId, createdAt, and brand are required.");
        });

        it('should return an error for invalid createdAt date format', async () => {
            const result = await recordMentionEvent({ tweetId: "invalidDate", createdAt: "invalid-date", brand: "TestBrand" });
            expect(result.success).toBe(false);
            expect(result.error).toBe("Invalid eventData: createdAt is not a valid ISO date string.");
        });
    });

    describe('getSentimentTrends', () => {
        it('should return sentiment trends for a given period and brand', async () => {
            await recordMentionEvent(sampleMentionData);
            await recordMentionEvent(sampleMentionData2);
            await recordMentionEvent({ ...sampleMentionData, tweetId: "ts003", sentiment: "neutral", createdAt: "2025-05-11T11:00:00.000Z" });

            const trends = await getSentimentTrends({ period: 'daily', brand: 'TestBrand' });
            expect(Array.isArray(trends)).toBe(true);
            expect(trends.length).toBeGreaterThan(0);
            expect(trends[0]).toHaveProperty('date');
            expect(trends[0]).toHaveProperty('positive');
            expect(trends[0]).toHaveProperty('negative');
            expect(trends[0]).toHaveProperty('neutral');
            expect(trends[0].brand).toBe('TestBrand');
        });
    });

    describe('getVolumeByDimension', () => {
        beforeEach(async () => {
            await _clearAnalyticsData_TEST_ONLY();
            await recordMentionEvent(sampleMentionData);
            await recordMentionEvent(sampleMentionData2);
            await recordMentionEvent(sampleMentionDataDifferentBrand);
        });

        it('should return volume by sentiment for TestBrand', async () => {
            const volume = await getVolumeByDimension({ dimension: 'sentiment', period: 'weekly', brand: 'TestBrand' });
            expect(Array.isArray(volume)).toBe(true);
            expect(volume.length).toBeGreaterThan(0);
            expect(volume[0]).toHaveProperty('sentiment');
            expect(volume[0]).toHaveProperty('count');
            expect(volume[0].brand).toBe('TestBrand');
        });

        it('should return volume by intent for AnotherBrand', async () => {
            const volume = await getVolumeByDimension({ dimension: 'intent', period: 'monthly', brand: 'AnotherBrand' });
            expect(Array.isArray(volume)).toBe(true);
            expect(volume.length).toBeGreaterThan(0);
            expect(volume[0]).toHaveProperty('intent');
            expect(volume[0]).toHaveProperty('count');
            expect(volume[0].brand).toBe('AnotherBrand');
        });
    });

    describe('identifyEmergingTopics', () => {
        it('should return a list of emerging topics for TestBrand', async () => {
            await recordMentionEvent(sampleMentionData);
            await recordMentionEvent(sampleMentionData2);
            await recordMentionEvent({ ...sampleMentionData, tweetId: "topic003", tweetText: "More talk about new_feature_X and its benefits." });

            const topics = await identifyEmergingTopics({ period: 'weekly', brand: 'TestBrand' });
            expect(Array.isArray(topics)).toBe(true);
            expect(topics.length).toBeGreaterThan(0);
            expect(topics[0]).toHaveProperty('topic');
            expect(topics[0]).toHaveProperty('mentions');
            expect(topics[0]).toHaveProperty('sentimentShift');
            expect(topics[0].brand).toBe('TestBrand');
        });
    });

    describe('generateSummaryReport', () => {
        it('should generate a summary report object for ReportBrand', async () => {
            const reportBrandData1 = { ...sampleMentionData, brand: "ReportBrand", tweetId: "rb001", sentiment: "positive", intent: "feedback" };
            const reportBrandData2 = { ...sampleMentionData2, brand: "ReportBrand", tweetId: "rb002", sentiment: "negative", intent: "complaint" };
            const reportBrandData3 = { ...sampleMentionData, brand: "ReportBrand", tweetId: "rb003", sentiment: "neutral", intent: "question", tweetText: "A neutral question for ReportBrand about pricing." };

            await recordMentionEvent(reportBrandData1);
            await recordMentionEvent(reportBrandData2);
            await recordMentionEvent(reportBrandData3);

            const report = await generateSummaryReport({ period: 'monthly', brand: 'ReportBrand' });
            expect(report).toHaveProperty('brand', 'ReportBrand');
            expect(report).toHaveProperty('period', 'monthly');
            expect(report).toHaveProperty('totalMentions');
            expect(report.totalMentions).toBe(3);
            expect(report).toHaveProperty('sentimentBreakdown');
            expect(report).toHaveProperty('intentBreakdown');
            expect(report).toHaveProperty('emergingTopics');
            expect(report).toHaveProperty('generatedAt');
        });
    });
});

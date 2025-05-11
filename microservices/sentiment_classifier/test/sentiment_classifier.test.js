import { analyzeSentimentForTweets } from '../src/index.js'; 

// --- IMPORTANT ---
// The following is a DUMMY implementation for 'analyzeSentimentForTweets'
// to allow these tests to be parsable and to illustrate the expected function signature.
// This SHOULD BE REMOVED once the actual '../src/sentiment_classifier.js' is implemented
// and the import line at the top is uncommented.

// let analyzeSentimentForTweets;

// if (typeof require !== 'undefined' && typeof module !== 'undefined') { // Check if in Node.js like environment
//     try {
//         // Attempt to load the actual module if it exists
//         const actualModule = require('../src/sentiment_classifier');
//         analyzeSentimentForTweets = actualModule.analyzeSentimentForTweets;
//         if (typeof analyzeSentimentForTweets !== 'function') {
//             // Fallback to dummy if the function isn't exported or module is incomplete
//             console.warn("WARN: 'analyzeSentimentForTweets' not found or not a function in '../src/sentiment_classifier.js'. Using a dummy implementation for tests.");
//             throw new Error("Not found or not a function"); // Trigger catch block
//         }
//     } catch (e) {
//         // console.warn("WARN: '../src/sentiment_classifier.js' not found or 'analyzeSentimentForTweets' not exported. Using a dummy implementation for tests.");
//         analyzeSentimentForTweets = (tweets) => {
//             if (!Array.isArray(tweets)) {
//                 console.error("Dummy analyzeSentimentForTweets: Input was not an array.");
//                 return []; // Or throw new Error("Input must be an array of tweets.");
//             }
//             return tweets.map(tweet => {
//                 const text = tweet.tweetText ? tweet.tweetText.toLowerCase() : "";
//                 let sentiment = 'neutral'; // Default dummy sentiment
//                 if (text.includes('wonderful') || text.includes('excellent') || text.includes('happy') || text.includes('love') || text.includes('amazing')) {
//                     sentiment = 'positive';
//                 } else if (text.includes('terrible') || text.includes('horrible') || text.includes('sad') || text.includes('worst') || text.includes('awful')) {
//                     sentiment = 'negative';
//                 }
//                 return { ...tweet, sentiment };
//             });
//         };
//     }
// } else {
//      analyzeSentimentForTweets = (tweets) => { /* Fallback dummy for non-Node.js like test env */ return tweets.map(t => ({...t, sentiment: 'neutral'})); };
// }
// --- END DUMMY IMPLEMENTATION ---


describe('Sentiment Classifier Microservice', () => {
    describe('analyzeSentimentForTweets function', () => {
        const baseTweetData = {
            tweetId: "sampleTweet123",
            userId: "user789",
            screenName: "TestUser",
            name: "Test User Display",
            createdAt: new Date().toISOString(),
            favoriteCount: 0,
            retweetCount: 0,
            lang: "en",
            type: "tweet" // This field is from mention_analyzer's output
        };

        it('should correctly classify a tweet with positive sentiment', () => {
            const tweets = [{ ...baseTweetData, tweetId: "pos01", tweetText: "This is a wonderful and excellent product! I am so happy." }];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            expect(results[0].sentiment).toBe('positive');
            expect(results[0].tweetId).toBe("pos01");
        });

        it('should correctly classify a tweet with negative sentiment', () => {
            const tweets = [{ ...baseTweetData, tweetId: "neg01", tweetText: "What a terrible experience, I am very sad about this." }];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            expect(results[0].sentiment).toBe('negative');
        });

        it('should correctly classify a tweet with neutral sentiment', () => {
            const tweets = [{ ...baseTweetData, tweetId: "neu01", tweetText: "The weather today is cloudy." }];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            expect(results[0].sentiment).toBe('neutral');
        });

        it('should process an array of tweets and return sentiments for each', () => {
            const tweets = [
                { ...baseTweetData, tweetId: "multi01", tweetText: "I love this, it's amazing!" },
                { ...baseTweetData, tweetId: "multi02", tweetText: "This is the worst thing ever." },
                { ...baseTweetData, tweetId: "multi03", tweetText: "The meeting is at 3 PM." }
            ];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(3);
            expect(results.find(r => r.tweetId === "multi01").sentiment).toBe('positive');
            expect(results.find(r => r.tweetId === "multi02").sentiment).toBe('negative');
            expect(results.find(r => r.tweetId === "multi03").sentiment).toBe('neutral');
        });

        it('should return an empty array when given an empty array', () => {
            const tweets = [];
            const results = analyzeSentimentForTweets(tweets);
            expect(results).toEqual([]);
        });

        it('should preserve all original tweet fields and add a sentiment field', () => {
            const originalTweet = {
                tweetId: "fields01",
                userId: "userFields",
                screenName: "FieldsUser",
                name: "Fields User D",
                tweetText: "Checking field preservation.",
                createdAt: new Date().toISOString(),
                favoriteCount: 10,
                retweetCount: 2,
                lang: "en",
                type: "tweet"
            };
            const tweets = [originalTweet];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            const resultTweet = results[0];
            
            for (const key in originalTweet) {
                expect(resultTweet[key]).toEqual(originalTweet[key]);
            }
            expect(resultTweet.sentiment).toBeDefined();
            
            const expectedKeys = [...Object.keys(originalTweet), 'sentiment'];
            expect(Object.keys(resultTweet).sort()).toEqual(expectedKeys.sort());
        });

        it('should handle tweets with empty text content (e.g., classify as neutral)', () => {
            const tweets = [{ ...baseTweetData, tweetId: "emptyText01", tweetText: "" }];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            expect(results[0].sentiment).toBe('neutral');
        });

        it('should handle tweets in languages other than English (defaulting to neutral for the dummy)', () => {
            const tweets = [{ ...baseTweetData, tweetId: "lang01", tweetText: "Esto es una prueba.", lang: "es" }];
            const results = analyzeSentimentForTweets(tweets);
            expect(results.length).toBe(1);
            expect(results[0].sentiment).toBe('neutral'); 
        });
    });
});

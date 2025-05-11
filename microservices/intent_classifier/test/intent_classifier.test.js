import { classifyIntentAndType } from '../src/index.js';

// --- IMPORTANT ---
// The following is a DUMMY implementation for 'classifyIntentAndType'
// to allow these tests to be parsable and to illustrate the expected function signature.
// This SHOULD BE REMOVED once the actual '../src/intent_classifier.js' is implemented
// and the import line at the top is uncommented.

// let classifyIntentAndType;

// if (typeof require !== 'undefined' && typeof module !== 'undefined') { // Check if in Node.js like environment
//     try {
//         const actualModule = require('../src/intent_classifier');
//         classifyIntentAndType = actualModule.classifyIntentAndType;
//         if (typeof classifyIntentAndType !== 'function') {
//             console.warn("WARN: 'classifyIntentAndType' not found or not a function in '../src/intent_classifier.js'. Using a dummy implementation for tests.");
//             throw new Error("Not found or not a function");
//         }
//     } catch (e) {
//         // console.warn("WARN: '../src/intent_classifier.js' not found or 'classifyIntentAndType' not exported. Using a dummy implementation for tests.");
//         classifyIntentAndType = (mentions) => {
//             if (!Array.isArray(mentions)) {
//                 console.error("Dummy classifyIntentAndType: Input was not an array.");
//                 return [];
//             }
//             return mentions.map(mention => {
//                 const text = mention.tweetText ? mention.tweetText.toLowerCase() : "";
//                 let intent = 'other';
//                 let handlingType = 'manual_review'; // Default for 'other'

//                 if (text.includes('how do i') || text.includes('what is') || text.includes('can you tell me')) {
//                     intent = 'question';
//                     if (text.includes('simple') || text.includes('reset password')) {
//                         handlingType = 'type1_bot';
//                     } else {
//                         handlingType = 'type2_human';
//                     }
//                 } else if (text.includes('broken') || text.includes('not working') || text.includes('i hate this')) {
//                     intent = 'complaint';
//                     if (text.includes('urgent') || text.includes('immediately')) {
//                         handlingType = 'type2_human';
//                     } else {
//                         handlingType = 'type1_bot';
//                     }
//                 } else if (text.includes('great job') || text.includes('love it') || text.includes('good feature')) {
//                     intent = 'feedback';
//                     handlingType = 'acknowledge_log';
//                 }
//                 return { ...mention, intent, handlingType };
//             });
//         };
//     }
// } else {
//     classifyIntentAndType = (mentions) => { /* Fallback dummy for non-Node.js like test env */ return mentions.map(m => ({...m, intent: 'other', handlingType: 'manual_review'})); };
// }
// --- END DUMMY IMPLEMENTATION ---
// The dummy implementation above is now removed as the actual function is imported.

describe('Intent Classifier Microservice', () => {
    describe('classifyIntentAndType function', () => {
        const baseMentionData = {
            tweetId: "mention123",
            userId: "user456",
            screenName: "IntentUser",
            name: "Intent User Display",
            tweetText: "This is a sample tweet text.",
            createdAt: new Date().toISOString(),
            favoriteCount: 5,
            retweetCount: 1,
            lang: "en",
            type: "tweet", // Field from mention_analyzer
            sentiment: "neutral" // Field from sentiment_classifier
        };

        it('should classify a simple question as intent:question and handlingType:type1_bot', () => {
            const mentions = [{ ...baseMentionData, tweetId: "q_bot_01", tweetText: "How do I reset password? It is a simple question." }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('question');
            expect(results[0].handlingType).toBe('type1_bot');
        });

        it('should classify a complex question as intent:question and handlingType:type2_human', () => {
            const mentions = [{ ...baseMentionData, tweetId: "q_human_01", tweetText: "Can you tell me the detailed specifications for this advanced product?" }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('question');
            expect(results[0].handlingType).toBe('type2_human');
        });

        it('should classify a minor complaint as intent:complaint and handlingType:type1_bot', () => {
            const mentions = [{ ...baseMentionData, tweetId: "c_bot_01", tweetText: "The link is broken on the help page." }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('complaint');
            expect(results[0].handlingType).toBe('type1_bot');
        });

        it('should classify an urgent complaint as intent:complaint and handlingType:type2_human', () => {
            const mentions = [{ ...baseMentionData, tweetId: "c_human_01", tweetText: "My account is not working and I need access immediately! This is urgent." }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('complaint');
            expect(results[0].handlingType).toBe('type2_human');
        });

        it('should classify positive feedback as intent:feedback and handlingType:acknowledge_log', () => {
            const mentions = [{ ...baseMentionData, tweetId: "f_ack_01", tweetText: "Great job on the new update, I love it!" }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('feedback');
            expect(results[0].handlingType).toBe('acknowledge_log');
        });

        it('should classify an ambiguous mention as intent:other and handlingType:manual_review', () => {
            const mentions = [{ ...baseMentionData, tweetId: "o_manual_01", tweetText: "Just saw your new ad on TV." }];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            expect(results[0].intent).toBe('other');
            expect(results[0].handlingType).toBe('manual_review');
        });

        it('should process an array of mentions and return classifications for each', () => {
            const mentions = [
                { ...baseMentionData, tweetId: "multi01", tweetText: "How do I find your store? It is a simple question.", sentiment: 'neutral' },
                { ...baseMentionData, tweetId: "multi02", tweetText: "This is terrible, my order is broken and I need help immediately!", sentiment: 'negative' },
                { ...baseMentionData, tweetId: "multi03", tweetText: "I really like the new design, good feature!", sentiment: 'positive' }
            ];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(3);
            expect(results.find(r => r.tweetId === "multi01").intent).toBe('question');
            expect(results.find(r => r.tweetId === "multi01").handlingType).toBe('type1_bot');
            expect(results.find(r => r.tweetId === "multi02").intent).toBe('complaint');
            expect(results.find(r => r.tweetId === "multi02").handlingType).toBe('type2_human');
            expect(results.find(r => r.tweetId === "multi03").intent).toBe('feedback');
            expect(results.find(r => r.tweetId === "multi03").handlingType).toBe('acknowledge_log');
        });

        it('should return an empty array when given an empty array', () => {
            const mentions = [];
            const results = classifyIntentAndType(mentions);
            expect(results).toEqual([]);
        });

        it('should preserve all original mention fields and add intent and handlingType fields', () => {
            const originalMention = {
                ...baseMentionData,
                tweetId: "fields01",
                tweetText: "Checking field preservation for intent.",
                sentiment: "positive"
            };
            const mentions = [originalMention];
            const results = classifyIntentAndType(mentions);
            expect(results.length).toBe(1);
            const resultMention = results[0];

            // Check original fields are preserved
            for (const key in originalMention) {
                expect(resultMention[key]).toEqual(originalMention[key]);
            }
            // Check new fields are added
            expect(resultMention.intent).toBeDefined();
            expect(resultMention.handlingType).toBeDefined();

            const expectedKeys = [...Object.keys(originalMention), 'intent', 'handlingType'];
            expect(Object.keys(resultMention).sort()).toEqual(expectedKeys.sort());
        });
    });
});

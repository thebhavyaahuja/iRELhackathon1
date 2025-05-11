const { extractAndAnalyzeMentions } = require('./mention_analyzer/src/mention_analyzer');
const { classifyIntentAndType } = require('./intent_classifier/src/index');
const { processMention } = require('./response_generator/src/response_generator');

async function runPipeline(searchQuery) {
    try {
        console.log(`Starting pipeline for search query: "${searchQuery}"`);

        // 1. Mention Analyzer
        const mentions = await extractAndAnalyzeMentions(searchQuery);
        console.log(`Found ${mentions.length} mentions.`);

        if (mentions.length === 0) {
            console.log("No mentions found. Exiting pipeline.");
            return;
        }

        // 2. Intent Classifier
        const classifiedMentions = classifyIntentAndType(mentions);
        console.log("Mentions classified.");

        // 3. Response Generator
        console.log("Processing mentions for response generation...");
        for (const mention of classifiedMentions) {
            // The response_generator's processMention expects 'response_type' but intent_classifier provides 'handlingType'
            // We need to map this or ensure consistency. For now, let's assume processMention can be adapted or
            // we can add a mapping step.
            // Let's also ensure all required fields by processMention are present.
            // processMention expects: text, tweetId, userId, url, intent, response_type
            // mention_analyzer provides: tweetId, userId, screenName, name, tweetText (as text), createdAt, favoriteCount, retweetCount, lang, tweetUrl (as url), type
            // intent_classifier adds: intent, handlingType (as response_type)

            const mentionForResponseGen = {
                text: mention.tweetText,
                tweetId: mention.tweetId,
                userId: mention.userId,
                url: mention.tweetUrl, // Ensure this is the correct field name from mention_analyzer
                intent: mention.intent,
                response_type: mention.handlingType // Map handlingType to response_type
            };
            
            // Add any other fields from mention that processMention might implicitly use or log
            if (mention.screenName) mentionForResponseGen.screenName = mention.screenName;
            if (mention.name) mentionForResponseGen.name = mention.name;


            await processMention(mentionForResponseGen);
        }

        console.log("Pipeline finished successfully.");

    } catch (error) {
        console.error("Error during pipeline execution:", error);
    }
}

// Example usage:
const searchQuery = process.argv[2]; // Get search query from command line argument

if (!searchQuery) {
    console.error("Please provide a search query as a command line argument.");
    console.log("Example: node pipeline.js \"customer support\"");
    process.exit(1);
}

runPipeline(searchQuery);

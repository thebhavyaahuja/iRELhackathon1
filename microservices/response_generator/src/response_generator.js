require('dotenv').config(); // Load environment variables from .env file

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require('pg'); // Added for PostgreSQL

// Initialize the Gemini client with the API key
// IMPORTANT: It's best practice to use an environment variable for the API key in production.
// For this example, we are using the key directly as requested.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Read from .env via process.env

if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY not found. Make sure it is set in your .env file.");
    // Optionally exit if the key is crucial, e.g., process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or your preferred model, e.g., "gemini-1.5-flash"

// Initialize PostgreSQL Pool
// IMPORTANT: Replace with your actual database connection details.
// It's best practice to use environment variables for these in production.
const pool = new Pool({
  user: process.env.DB_USER || 'social_app_user', // Replace with your DB user or use env var
  host: process.env.DB_HOST || 'localhost',    // Replace with your DB host or use env var
  database: process.env.DB_NAME || 'social_tickets', // Replace with your DB name or use env var
  password: process.env.DB_PASSWORD || 'postgres_password', // Replace with your DB password or use env var
  port: process.env.DB_PORT || 5432,             // Replace with your DB port or use env var
});

// Optional: Test DB connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err);
  } else {
    console.log('Successfully connected to PostgreSQL database. Current time:', res.rows[0].now);
  }
});

/**
 * Processes intent-classified mention data to generate responses or escalate issues.
 *
 * @param {object} mentionData - The data from the Intent Recognizer.
 * @param {string} mentionData.text - The text of the mention.
 * @param {string} mentionData.tweetId - The ID of the tweet.
 * @param {string} mentionData.userId - The ID of the user who made the tweet.
 * @param {string} mentionData.url - The URL of the tweet.
 * @param {('question'|'complaint'|'feedback'|'other')} mentionData.intent - The classified intent of the mention.
 * @param {('bot'|'human')} mentionData.response_type - The type of response required.
 */
async function processMention(mentionData) {
    console.log("Response Generator received mention data:", mentionData);

    const { intent, response_type, text, tweetId, userId, url } = mentionData;

    if ((intent === "question" || intent === "complaint") && response_type === "bot") {
        // TODO: Implement Gemini API call to generate a suitable response
        console.log(`Intent is '${intent}', response type is 'bot'. Generating automated response for tweet: ${url}`);
        const botResponse = await generateBotResponse(text, intent, url);
        // TODO: Post botResponse to the social media platform
        console.log(`Generated bot response: "${botResponse}" for tweet: ${url}`);
        // TODO: Log the interaction
    } else if ((intent === "question" || intent === "complaint") && response_type === "human") {
        // TODO: Implement logic to open a ticket in a database
        console.log(`Intent is '${intent}', response type is 'human'. Escalating tweet: ${url} for human intervention.`);
        await openTicketForHumanIntervention(mentionData);
        // TODO: Send notifications/alerts to the relevant team
    } else if (intent === "feedback") {
        // TODO: May generate an automated acknowledgment or log for analytics
        console.log(`Intent is 'feedback'. Logging feedback from tweet: ${url}`);
        // TODO: Log the positive interaction for analytics.
    } else if (intent === "other") {
        console.log(`Intent is 'other'. No specific action defined for tweet: ${url}`);
        // TODO: Log or handle as per business rules for 'other' intents
    } else {
        console.warn("Unknown intent or response type:", mentionData);
    }
}

/**
 * Generates a bot response using a generative AI model (e.g., Gemini).
 * This is a placeholder and needs to be implemented.
 * @param {string} mentionText - The text of the mention.
 * @param {string} intent - The intent of the mention.
 * @param {string} tweetUrl - The URL of the tweet.
 * @returns {Promise<string>} - The generated bot response.
 */
async function generateBotResponse(mentionText, intent, tweetUrl) {
    // Placeholder for Gemini API call
    console.log(`Calling Gemini API for: "${mentionText}" (Intent: ${intent}, URL: ${tweetUrl})`);
    
    // Construct the prompt for Gemini
    let prompt = "";
    if (intent === "question") {
        prompt = `As a brand representative, provide a helpful and concise answer to the following customer question. If you cannot answer, politely say so and suggest checking official resources or contacting support. Question: "${mentionText}"`;
    } else if (intent === "complaint") {
        prompt = `As a brand representative, provide an empathetic and helpful initial response to the following customer complaint. Acknowledge their concern and suggest a way to resolve it (e.g., contact support, DM for details). Do not make specific promises you can't keep. Complaint: "${mentionText}"`;
    } else {
        // Fallback for other intents if this function is ever called with them
        prompt = `Respond to the following message: "${mentionText}"`;
    }

    try {
        // Actual Gemini API call
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const geminiText = response.text();
        
        console.log(`Gemini Response: ${geminiText}`);
        return geminiText; 

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Fallback response in case of API error
        return "We've received your message and will get back to you as soon as possible. Our apologies for any inconvenience.";
    }
}

/**
 * Opens a ticket for human intervention.
 * This is a placeholder and needs to be implemented with actual database/ticketing system logic.
 * @param {object} mentionData - The full mention data.
 */
async function openTicketForHumanIntervention(mentionData) {
    console.log("Opening ticket for human intervention:", mentionData);
    const { tweetId, userId, text, url, intent } = mentionData;

    const queryText = 'INSERT INTO tickets(tweet_id, user_id, tweet_text, tweet_url, intent, status, created_at) VALUES($1, $2, $3, $4, $5, $6, NOW()) RETURNING id';
    const values = [tweetId, userId, text, url, intent, 'open']; // Default status to 'open'

    try {
        const result = await pool.query(queryText, values);
        console.log(`Ticket opened with ID: ${result.rows[0].id} for tweet: ${url}`);
        return result.rows[0].id;
    } catch (error) {
        console.error("Error opening ticket in database:", error);
        // Fallback or re-throw error as appropriate for your error handling strategy
        throw error; // Re-throwing the error so the caller can be aware
    }
}

module.exports = { processMention };

// Example Usage (for testing purposes, remove or comment out in production)

async function testResponseGenerator() {
    const sampleMentionBot = {
        text: "what is the search feature in website?",
        tweetId: "12345",
        userId: "user789",
        url: "https://x.com/user789/status/12345",
        intent: "question",
        response_type: "bot"
    };

    const sampleMentionHuman = {
        text: "Your app crashed and I lost all my data! This is unacceptable!",
        tweetId: "67890",
        userId: "user101",
        url: "https://x.com/user101/status/67890",
        intent: "complaint",
        response_type: "human"
    };
    
    const sampleMentionFeedback = {
        text: "I love the new feature, it's amazing!",
        tweetId: "11223",
        userId: "userHappy",
        url: "https://x.com/userHappy/status/11223",
        intent: "feedback",
        response_type: "bot" // Or could be 'none' depending on rules
    };

    await processMention(sampleMentionBot);
    await processMention(sampleMentionHuman);
    await processMention(sampleMentionFeedback);
}

testResponseGenerator(); // Make sure this line is uncommented for the test
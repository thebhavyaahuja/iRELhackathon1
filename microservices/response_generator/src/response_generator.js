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
        console.log(`Intent is '${intent}', response type is 'bot'. Generating automated response for tweet: ${url}`);
        const botResponse = await generateBotResponse(text, intent, url);
        console.log(`Generated bot response: "${botResponse}" for tweet: ${url}`);
        
        if (botResponse && !botResponse.startsWith("We've received your message")) { // Avoid tweeting fallback messages
            try {
                await postTweetResponse(botResponse, tweetId, url);
                console.log(`Successfully posted bot response to X for tweet: ${url}`);
            } catch (error) {
                console.error(`Failed to post tweet response for ${url}:`, error);
                // Log failed interaction attempt
                console.log(`Interaction logged: Failed to post bot response for tweet ${tweetId} (URL: ${url})`);
            }
        } else {
            console.log(`Skipped posting fallback message for tweet: ${url}`);
            // Log skipped interaction
            console.log(`Interaction logged: Skipped posting bot response (fallback message) for tweet ${tweetId} (URL: ${url})`);
        }
    } else if ((intent === "question" || intent === "complaint") && response_type === "human") {
        console.log(`Intent is '${intent}', response type is 'human'. Escalating tweet: ${url} for human intervention.`);
        try {
            const ticketId = await openTicketForHumanIntervention(mentionData);
            console.log(`Interaction logged: Ticket ${ticketId} opened for tweet ${tweetId} (URL: ${url})`);
            // TODO: Send notifications/alerts to the relevant team for human intervention tickets (e.g., via email, Slack).
            console.log(`Placeholder: Notification sent to human team for ticket ${ticketId} regarding tweet ${url}`);
        } catch (error) {
            console.error(`Failed to open ticket for ${url}:`, error);
            console.log(`Interaction logged: Failed to open ticket for tweet ${tweetId} (URL: ${url})`);
        }
    } else if (intent === "feedback") {
        console.log(`Intent is 'feedback'. Logging feedback from tweet: ${url}`);
        // Log the feedback interaction for analytics.
        // For now, just a console log. In a real system, this might go to a different table or analytics service.
        console.log(`Interaction logged: Feedback received from tweet ${tweetId} (URL: ${url}). Text: "${text}"`);
    } else if (intent === "other") {
        console.log(`Intent is 'other'. No specific action defined for tweet: ${url}`);
        // Log or handle as per business rules for 'other' intents
        console.log(`Interaction logged: 'Other' intent received for tweet ${tweetId} (URL: ${url}). Text: "${text}"`);
    } else {
        console.warn("Unknown intent or response type:", mentionData);
        console.log(`Interaction logged: Unknown intent/response type for tweet ${tweetId} (URL: ${url})`);
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
        return "We've received your message and will get back to you as soon as possible. Our apologies for any inconvenience."; // Ensure this is a string
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

    try {
        // Check if a ticket with this tweetId already exists
        const checkQueryText = 'SELECT id FROM tickets WHERE tweet_id = $1';
        const checkResult = await pool.query(checkQueryText, [tweetId]);

        if (checkResult.rows.length > 0) {
            const existingTicketId = checkResult.rows[0].id;
            console.log(`Ticket for tweet_id: ${tweetId} already exists with id: ${existingTicketId}. (URL: ${url})`);
            return existingTicketId; // Return the ID of the existing ticket
        }

        // If no existing ticket, insert a new one
        const insertQueryText = 'INSERT INTO tickets(tweet_id, user_id, tweet_text, tweet_url, intent, status, created_at) VALUES($1, $2, $3, $4, $5, $6, NOW()) RETURNING id';
        const values = [tweetId, userId, text, url, intent, 'open']; // Default status to 'open'
        
        const insertResult = await pool.query(insertQueryText, values);

        if (insertResult.rows.length > 0) {
            const newTicketId = insertResult.rows[0].id;
            console.log(`New ticket opened with id: ${newTicketId} for tweet_id: ${tweetId} (URL: ${url})`);
            return newTicketId; // Return the auto-generated id of the new ticket
        } else {
            console.error(`Failed to insert new ticket for tweet_id: ${tweetId}. No id returned from insert operation.`);
            throw new Error(`Failed to insert new ticket for tweet_id: ${tweetId}. No id returned.`);
        }
    } catch (error) {
        console.error("Error opening ticket in database:", error);
        // Fallback or re-throw error as appropriate for your error handling strategy
        throw error; // Re-throwing the error so the caller can be aware
    }
}

// Function to post a tweet response using the scraped request structure
async function postTweetResponse(tweetText, inReplyToTweetId, originalTweetUrl) {
    const apiUrl = "https://x.com/i/api/graphql/dOominYnbOIOpEdRJ7_lHw/CreateTweet";
    
    // These headers are taken from your tweet_req.js file.
    // WARNING: These are likely to be session-specific and will expire.
    const headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA", // Public bearer token
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not.A/Brand\";v=\"99\", \"Chromium\";v=\"136\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        // TODO: The x-client-transaction-id might need to be dynamic. Using the one from tweet_req.js for now.
        "x-client-transaction-id": "WOyt8zmK5Fj4F1VQFgfaxeK6AJmzoRUWNQQHf+EGOv1/m3U7rkXQr65WNIswswFo0N8piVtjv1Di57bEHE/dS3KmeI5mWw",
        // TODO: The x-csrf-token is critical and tied to the cookie. This will expire.
        "x-csrf-token": "89a451794283aec91942d9843effbe3b0aad5cc40d94a5235a69be19f1b7c58ca8c1eb630772ca086ea8d9f729bf93dd4fa82163670c0fc53025b9270bebcc6d99bbcf548e4ffff6d02c5307096f310d",
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": "en",
        // TODO: The cookie is critical and will expire.
        "cookie": "guest_id=v1%3A171111727480469151; night_mode=2; guest_id_marketing=v1%3A171111727480469151; guest_id_ads=v1%3A171111727480469151; g_state={\"i_l\":0}; kdt=sCNrpgn8xoVp1N2Af0c5Yghr612S9QkZ0P1v61R7; lang=en; personalization_id=\"v1_Fj7mqz3rWrvj6Uoi7HDW8g==\"; auth_token=c454b43ea4e0f9c0f6edfe0989c069b4c2f0c6e2; ct0=89a451794283aec91942d9843effbe3b0aad5cc40d94a5235a69be19f1b7c58ca8c1eb630772ca086ea8d9f729bf93dd4fa82163670c0fc53025b9270bebcc6d99bbcf548e4ffff6d02c5307096f310d; twid=u%3D1679775308751175680; ph_phc_TXdpocbGVeZVm5VJmAsHTMrCofBQu3e0kN8HGMNGTVW_posthog=%7B%22distinct_id%22%3A%220196bb81-3afd-72d3-9ac0-42adfa0e0649%22%2C%22%24sesid%22%3A%5B1746902530849%2C%220196bb81-3afc-70c7-b9b6-3632297bec3c%22%2C1746902530812%5D%7D; __cf_bm=KBw1w.SyPnx7h2wlEoNWL7oXVq5faog9BVyEyDM88S0-1746982079-1.0.1.1-r0TcgtL33PclBTT9_T9pUceOgxY13ugU4h2nHRILhNoHtYp677eBVCHv5IjyBRs3izDJlaNljg17RQxzWWAf2WosfeUWUomU303bxTQPaQK65hSgVszwZJlTsiOurDG7",
        "Referer": originalTweetUrl, // Set Referer to the URL of the tweet being replied to
        "Referrer-Policy": "strict-origin-when-cross-origin"
    };

    const body = {
        "variables": {
            "tweet_text": tweetText,
            "reply": {
                "in_reply_to_tweet_id": inReplyToTweetId,
                "exclude_reply_user_ids": []
            },
            "dark_request": false,
            "media": {
                "media_entities": [],
                "possibly_sensitive": false
            },
            "semantic_annotation_ids": [],
            "disallowed_reply_options": null // Added based on typical CreateTweet structure
        },
        "features": { // Copied from your tweet_req.js
            "premium_content_api_read_enabled":false,
            "communities_web_enable_tweet_community_results_fetch":true,
            "c9s_tweet_anatomy_moderator_badge_enabled":true,
            "responsive_web_grok_analyze_button_fetch_trends_enabled":false,
            "responsive_web_grok_analyze_post_followups_enabled":true,
            "responsive_web_jetfuel_frame":false,
            "responsive_web_grok_share_attachment_enabled":true,
            "responsive_web_edit_tweet_api_enabled":true,
            "graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,
            "view_counts_everywhere_api_enabled":true,
            "longform_notetweets_consumption_enabled":true,
            "responsive_web_twitter_article_tweet_consumption_enabled":true,
            "tweet_awards_web_tipping_enabled":false,
            "responsive_web_grok_show_grok_translated_post":false,
            "responsive_web_grok_analysis_button_from_backend":true,
            "creator_subscriptions_quote_tweet_preview_enabled":false,
            "longform_notetweets_rich_text_read_enabled":true,
            "longform_notetweets_inline_media_enabled":true,
            "profile_label_improvements_pcf_label_in_post_enabled":true,
            "rweb_tipjar_consumption_enabled":true,
            "verified_phone_label_enabled":true,
            "articles_preview_enabled":true,
            "responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,
            "freedom_of_speech_not_reach_fetch_enabled":true,
            "standardized_nudges_misinfo":true,
            "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,
            "responsive_web_grok_image_annotation_enabled":true,
            "responsive_web_graphql_timeline_navigation_enabled":true,
            "responsive_web_enhance_cards_enabled":false
        },
        "queryId": "dOominYnbOIOpEdRJ7_lHw" // Copied from your tweet_req.js
    };

    console.log(`Attempting to post tweet reply to ${inReplyToTweetId}: "${tweetText}"`);

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error(`Error posting tweet. Status: ${response.status} ${response.statusText}`, responseData);
            throw new Error(`Network response was not ok: ${response.statusText}. Body: ${JSON.stringify(responseData)}`);
        }
        
        if (responseData.errors && responseData.errors.length > 0) {
            console.error("Error from X API while creating tweet:", responseData.errors);
            throw new Error(`X API Error: ${responseData.errors[0].message}`);
        }

        if (responseData.data && responseData.data.create_tweet && responseData.data.create_tweet.tweet_results && responseData.data.create_tweet.tweet_results.result) {
            console.log("Successfully posted tweet. Response:", JSON.stringify(responseData.data.create_tweet.tweet_results.result, null, 2));
            return responseData.data.create_tweet.tweet_results.result;
        } else {
            console.warn("Tweet may have been posted, but response format was unexpected:", responseData);
            return responseData; // Return the full response if structure is not as expected
        }

    } catch (error) {
        console.error("Failed to post tweet:", error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

module.exports = { processMention, postTweetResponse }; // Added postTweetResponse to exports

// Example Usage (for testing purposes, remove or comment out in production)

async function testResponseGenerator() {
    // const sampleMentionBot = {
    //     text: "what is the search feature in website?",
    //     tweetId: "12345",
    //     userId: "user789",
    //     url: "https://x.com/user789/status/12345",
    //     intent: "question",
    //     response_type: "bot"
    // };
    const sampleMentionBot = {
        text: "heritage icecream is the worst", // Customize if you like
        tweetId: "1920692929854669139", // Replace with a valid Tweet ID
        userId: "user789", // This is less critical for the posting part
        url: "hhttps://x.com/ky00nnie/status/1920692929854669139", // Replace with the URL of that Tweet
        intent: "question",
        response_type: "bot"
    };

    const sampleMentionHuman = {
        text: "what is the developer's wife's name?",
        tweetId: "67821",
        userId: "user101",
        url: "https://x.com/user101/status/67890",
        intent: "question",
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
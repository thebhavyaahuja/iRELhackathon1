# Mention Analyzer Microservice

## 1. Purpose

The Mention Analyzer microservice is responsible for searching a social media platform (currently X/Twitter via an internal API endpoint) for a given query. It then extracts and analyzes mentions, identifying user profiles and tweets related to the search query. The extracted mentions are structured and returned for further processing by other services, such as an analytics engine or a response generator.

## 2. How it Works

The service takes a search query string as input. It constructs a request to an X/Twitter GraphQL API endpoint, including the search query and predefined feature flags. The headers for this request, including authorization tokens, are currently hardcoded.

Upon receiving a response, the service parses the JSON data. It iterates through the timeline instructions and entries to identify:
-   **User Profiles**: Extracts details like user ID, screen name, name, description, location, follower/friend counts, and profile image URL.
-   **Tweets**: Extracts details like tweet ID, user ID of the author, screen name, name, full tweet text, creation date, favorite/retweet counts, and language.

These extracted mentions are then returned as an array of objects.

## 3. API

The microservice exposes a single primary function:

### `extractAndAnalyzeMentions(searchQuery)`

-   **Input**:
    -   `searchQuery` (String): The term or phrase to search for on the platform.
-   **Output**:
    -   (Promise<Array<Object>>): A promise that resolves to an array of mention objects. Each object will have a `type` field indicating if it's a `'user_profile'` or a `'tweet'`.

    **User Profile Object Structure:**
    ```json
    {
        "id": "string", // User's unique ID
        "screenName": "string", // User's screen name (e.g., @username)
        "name": "string", // User's display name
        "description": "string", // User's profile description
        "location": "string", // User's listed location
        "followersCount": "number", // Number of followers
        "friendsCount": "number", // Number of accounts the user is following
        "profileImageUrl": "string", // URL to the user's profile image
        "type": "user_profile"
    }
    ```

    **Tweet Object Structure:**
    ```json
    {
        "tweetId": "string", // Tweet's unique ID
        "userId": "string", // Author's unique ID
        "screenName": "string", // Author's screen name
        "name": "string", // Author's display name
        "tweetText": "string", // Full text content of the tweet
        "createdAt": "string", // Date and time of tweet creation
        "favoriteCount": "number", // Number of likes/favorites
        "retweetCount": "number", // Number of retweets
        "lang": "string", // Language of the tweet (e.g., "en")
        "type": "tweet"
    }
    ```
-   **Errors**:
    -   Throws an `Error` if the network request fails or if the API returns a non-ok status. The error message will include the status text and potentially the response body.

## 4. Setup and Usage

### Prerequisites
-   Node.js
-   npm (or yarn)

### Installation
The service is part of a larger monorepo structure. Dependencies for testing are managed by its own `package.json`.
To install development dependencies for this specific microservice (e.g., Jest for testing):
```bash
cd iRELhackathon1/microservices/mention_analyzer
npm install
```

### Running the Service
The `mention_analyzer` is a module that can be imported into other Node.js services.
```javascript
// Example: another_service.js
const { extractAndAnalyzeMentions } = require('./mention_analyzer/src/mention_analyzer'); // Adjust path as needed

async function someFunction() {
    try {
        const mentions = await extractAndAnalyzeMentions("your search query");
        console.log(mentions);
        // Send mentions to a message bus or another service
    } catch (error) {
        console.error("Error fetching mentions:", error);
    }
}

someFunction();
```

### Running Tests
Tests are written using Jest and are located in the `tests/` directory. To run the tests:
```bash
cd iRELhackathon1/microservices/mention_analyzer
npm test
```

## 5. Configuration

Currently, the API endpoint and request headers, including the Bearer token for authorization, are hardcoded in `src/mention_analyzer.js`.
```javascript
// src/mention_analyzer.js
const apiUrl = `https://x.com/i/api/graphql/yiE17ccAAu3qwM34bPYZkQ/SearchTimeline?variables=...&features=...`;
// ...
const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
        "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        // ... other headers
    },
    // ...
});
```
**Caution**: Hardcoding sensitive information like API tokens is not recommended for production environments. These should ideally be managed through environment variables or a configuration service.

## 6. Microservice Architecture Context

-   **Role**: Acts as a data collection service, specifically for social media mentions.
-   **Communication**:
    -   **Input**: It's designed to be called programmatically. In a larger system, it might receive search queries from an API Gateway, an orchestrator service, or messages from a message bus (e.g., Kafka, RabbitMQ).
    -   **Output**: The resulting array of mentions should be published to a message bus topic (e.g., `mentions_extracted`) for consumption by other microservices like the `sentiment_classifier` or `analytics_engine`. This promotes asynchronous communication and decoupling.
-   **Database**: This service is stateless and does not require its own database. It fetches data on demand.

## 7. Dependencies

-   **External**:
    -   Relies on an X/Twitter GraphQL API endpoint (`https://x.com/i/api/graphql/yiE17ccAAu3qwM34bPYZkQ/SearchTimeline`). Availability and rate limits of this API are external factors.
-   **Development**:
    -   `jest`: For running unit tests.

## 8. Error Handling

The service includes basic error handling for network requests:
-   If the `fetch` call fails to get a response (e.g., network issue) or if the response status is not `ok` (e.g., 4xx, 5xx errors), an error is thrown.
-   The calling service is responsible for catching these errors and handling them appropriately (e.g., logging, retrying, sending to a dead-letter queue).

Further enhancements could include more specific error types and retry mechanisms for transient network issues.

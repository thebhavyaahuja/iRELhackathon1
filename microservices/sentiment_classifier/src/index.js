export const analyzeSentimentForTweets = (tweets) => {
    if (!Array.isArray(tweets)) {
        console.error("Dummy analyzeSentimentForTweets: Input was not an array.");
        return []; // Or throw new Error("Input must be an array of tweets.");
    }
    return tweets.map(tweet => {
        const text = tweet.tweetText ? tweet.tweetText.toLowerCase() : "";
        let sentiment = 'neutral'; // Default dummy sentiment
        if (text.includes('wonderful') || text.includes('excellent') || text.includes('happy') || text.includes('love') || text.includes('amazing')) {
            sentiment = 'positive';
        } else if (text.includes('terrible') || text.includes('horrible') || text.includes('sad') || text.includes('worst') || text.includes('awful')) {
            sentiment = 'negative';
        }
        return { ...tweet, sentiment };
    });
};
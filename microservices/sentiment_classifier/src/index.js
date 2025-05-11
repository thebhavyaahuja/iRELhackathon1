import { Kafka, logLevel } from 'kafkajs';

// Kafka Configuration
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL || 'localhost:9092';
const CONSUMER_GROUP_ID = 'sentiment-classifier-group';
const INPUT_TOPIC = 'mentions_topic'; // Topic to consume from (output of mention_analyzer)
const OUTPUT_TOPIC = 'sentiment_classified_topic'; // Topic to produce to
const CLIENT_ID = 'sentiment-classifier-service';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [KAFKA_BROKER_URL],
  logLevel: logLevel.INFO, // Adjust log level as needed (ERROR, WARN, INFO, DEBUG)
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
const producer = kafka.producer();

let isConsumerConnected = false;
let isProducerConnected = false;

// Original sentiment analysis logic (dummy implementation)
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

// Kafka message processing
const processMessage = async (messageValue) => {
  try {
    const mention = JSON.parse(messageValue.toString());
    // console.log(`SentimentClassifier: Received mention: ${mention.tweetId || mention.id}`);

    // Use the existing (or a more sophisticated) sentiment analysis function
    // analyzeSentimentForTweets expects an array, so wrap the mention
    const [enrichedMention] = analyzeSentimentForTweets([mention]);

    if (enrichedMention) {
      console.log(`SentimentClassifier: Analyzed sentiment: ${enrichedMention.sentiment} for ${enrichedMention.tweetId || enrichedMention.id}`);
      await producer.send({
        topic: OUTPUT_TOPIC,
        messages: [{ value: JSON.stringify(enrichedMention) }],
      });
      // console.log(`SentimentClassifier: Published enriched mention to ${OUTPUT_TOPIC}`);
    } else {
      console.warn('SentimentClassifier: Sentiment analysis returned no result for:', mention);
    }
  } catch (error) {
    console.error('SentimentClassifier: Error processing message:', error);
    console.error('SentimentClassifier: Offending message value:', messageValue.toString());
    // Implement error handling, e.g., send to a dead-letter queue (DLQ)
  }
};

const run = async () => {
  try {
    await consumer.connect();
    isConsumerConnected = true;
    console.log(`SentimentClassifier: Consumer connected to ${KAFKA_BROKER_URL}, group ${CONSUMER_GROUP_ID}`);

    await producer.connect();
    isProducerConnected = true;
    console.log(`SentimentClassifier: Producer connected to ${KAFKA_BROKER_URL}`);

    await consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: true });
    console.log(`SentimentClassifier: Subscribed to topic ${INPUT_TOPIC}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        // console.log(`SentimentClassifier: Received message from ${topic} (partition ${partition}):`, {
        //   offset: message.offset,
        //   timestamp: message.timestamp,
        // });
        await processMessage(message.value);
      },
    });
  } catch (error) {
    console.error("SentimentClassifier: Error in Kafka consumer/producer setup or run:", error);
    // Consider a more robust retry or shutdown mechanism here
    await shutdown(); // Attempt to clean up
    process.exit(1); // Exit if critical setup fails
  }
};

const shutdown = async () => {
  console.log("SentimentClassifier: Shutting down...");
  try {
    if (isConsumerConnected) {
      await consumer.disconnect();
      isConsumerConnected = false;
      console.log("SentimentClassifier: Consumer disconnected.");
    }
  } catch (error) {
    console.error("SentimentClassifier: Error disconnecting consumer:", error);
  }
  try {
    if (isProducerConnected) {
      await producer.disconnect();
      isProducerConnected = false;
      console.log("SentimentClassifier: Producer disconnected.");
    }
  } catch (error) {
    console.error("SentimentClassifier: Error disconnecting producer:", error);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nSentimentClassifier: Received ${signal}.`);
  await shutdown();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the service
run().catch(async e => {
  console.error("SentimentClassifier: Unhandled error during run:", e);
  await shutdown();
  process.exit(1);
});
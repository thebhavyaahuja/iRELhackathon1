import { Kafka, logLevel } from 'kafkajs';

// Kafka Configuration
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL || 'localhost:9092';
const CONSUMER_GROUP_ID = 'intent-classifier-group';
const INPUT_TOPIC = 'sentiment_classified_topic'; // Topic to consume from
const OUTPUT_TOPIC = 'intent_classified_topic';    // Topic to produce to
const CLIENT_ID = 'intent-classifier-service';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [KAFKA_BROKER_URL],
  logLevel: logLevel.INFO, // Adjust as needed
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
const producer = kafka.producer();

let isConsumerConnected = false;
let isProducerConnected = false;

export const classifyIntentAndType = (mentions) => {
  if (!Array.isArray(mentions)) {
    console.error("Mock classifyIntentAndType: Input was not an array.");
    return [];
  }

  // Define possible intents and handling types with weights
  const intents = [
    { value: 'question', weight: 0.3 },
    { value: 'complaint', weight: 0.4 },
    { value: 'feedback', weight: 0.2 },
    { value: 'other', weight: 0.1 }
  ];

  const handlingTypes = [
    { value: 'bot', weight: 0.4 },
    { value: 'human', weight: 0.5 },
    { value: 'acknowledge_log', weight: 0.1 }
  ];

  // Weighted random choice function
  const weightedRandom = (items) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * total;
    
    for (const item of items) {
      if (random < item.weight) return item.value;
      random -= item.weight;
    }
    return items[0].value;
  };

  return mentions.map(mention => ({
    ...mention,
    intent: weightedRandom(intents),
    handlingType: weightedRandom(handlingTypes)
  }));
};

const processMessage = async (messageValue) => {
  try {
    const sentimentMention = JSON.parse(messageValue.toString());
    console.log(`IntentClassifier: Received mention from sentiment_classified_topic. TweetId: ${sentimentMention.tweetId}, Brand: ${sentimentMention.brand}, CreatedAt: ${sentimentMention.createdAt}, Sentiment: ${sentimentMention.sentiment}`);
    // For more detailed debugging, uncomment the line below:
    // console.log('IntentClassifier: Full incoming sentimentMention:', JSON.stringify(sentimentMention, null, 2));

    // classifyIntentAndType expects an array and returns an array
    const [intentMention] = classifyIntentAndType([sentimentMention]); // intentMention is { ...sentimentMention, intent, handlingType }

    if (intentMention) {
      // Log essential fields before sending
      console.log(`IntentClassifier: Sending to intent_classified_topic. TweetId: ${intentMention.tweetId}, Brand: ${intentMention.brand}, CreatedAt: ${intentMention.createdAt}, Sentiment: ${intentMention.sentiment}, Intent: ${intentMention.intent}`);
      // For more detailed debugging, uncomment the line below:
      // console.log('IntentClassifier: Full outgoing intentMention:', JSON.stringify(intentMention, null, 2));

      if (!intentMention.tweetId || !intentMention.createdAt || !intentMention.brand) {
        console.error('IntentClassifier: CRITICAL - Fields missing before sending to intent_classified_topic!', { tweetId: intentMention.tweetId, createdAt: intentMention.createdAt, brand: intentMention.brand });
      }

      await producer.send({
        topic: OUTPUT_TOPIC,
        messages: [{ value: JSON.stringify(intentMention) }],
      });
    } else {
      console.warn('IntentClassifier: Intent classification returned no result for (original sentimentMention):', sentimentMention);
    }
  } catch (error) {
    console.error('IntentClassifier: Error processing message:', error);
    console.error('IntentClassifier: Offending message value:', messageValue.toString());
    // Implement error handling, e.g., send to a dead-letter queue (DLQ)
  }
};

const run = async () => {
  try {
    await consumer.connect();
    isConsumerConnected = true;
    console.log(`IntentClassifier: Consumer connected to ${KAFKA_BROKER_URL}, group ${CONSUMER_GROUP_ID}`);

    await producer.connect();
    isProducerConnected = true;
    console.log(`IntentClassifier: Producer connected to ${KAFKA_BROKER_URL}`);

    await consumer.subscribe({ topic: INPUT_TOPIC, fromBeginning: true });
    console.log(`IntentClassifier: Subscribed to topic ${INPUT_TOPIC}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        // console.log(`IntentClassifier: Received message from ${topic} (partition ${partition}):`, {
        //   offset: message.offset,
        //   timestamp: message.timestamp,
        // });
        await processMessage(message.value);
      },
    });
  } catch (error) {
    console.error("IntentClassifier: Error in Kafka consumer/producer setup or run:", error);
    await shutdown();
    process.exit(1);
  }
};

const shutdown = async () => {
  console.log("IntentClassifier: Shutting down...");
  try {
    if (isConsumerConnected) {
      await consumer.disconnect();
      isConsumerConnected = false;
      console.log("IntentClassifier: Consumer disconnected.");
    }
  } catch (error) {
    console.error("IntentClassifier: Error disconnecting consumer:", error);
  }
  try {
    if (isProducerConnected) {
      await producer.disconnect();
      isProducerConnected = false;
      console.log("IntentClassifier: Producer disconnected.");
    }
  } catch (error) {
    console.error("IntentClassifier: Error disconnecting producer:", error);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nIntentClassifier: Received ${signal}.`);
  await shutdown();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the service
run().catch(async e => {
  console.error("IntentClassifier: Unhandled error during run:", e);
  await shutdown();
  process.exit(1);
});
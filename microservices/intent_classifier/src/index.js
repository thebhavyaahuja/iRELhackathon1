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
        console.error("Dummy classifyIntentAndType: Input was not an array.");
        return [];
    }
    return mentions.map(mention => {
        const text = mention.tweetText ? mention.tweetText.toLowerCase() : "";
        let intent = 'other';
        let handlingType = 'manual_review'; // Default for 'other'

        if (text.includes('how do i') || text.includes('what is') || text.includes('can you tell me')) {
            intent = 'question';
            if (text.includes('simple') || text.includes('reset password')) {
                handlingType = 'type1_bot';
            } else {
                handlingType = 'type2_human';
            }
        } else if (text.includes('broken') || text.includes('not working') || text.includes('i hate this')) {
            intent = 'complaint';
            if (text.includes('urgent') || text.includes('immediately')) {
                handlingType = 'type2_human';
            } else {
                handlingType = 'type1_bot';
            }
        } else if (text.includes('great job') || text.includes('love it') || text.includes('good feature')) {
            intent = 'feedback';
            handlingType = 'acknowledge_log';
        }
        return { ...mention, intent, handlingType };
    });
};

// Kafka message processing
const processMessage = async (messageValue) => {
  try {
    const sentimentMention = JSON.parse(messageValue.toString());
    // console.log(`IntentClassifier: Received sentiment-classified mention: ${sentimentMention.tweetId || sentimentMention.id}`);

    // classifyIntentAndType expects an array
    const [intentMention] = classifyIntentAndType([sentimentMention]);

    if (intentMention) {
      // console.log(`IntentClassifier: Classified intent: ${intentMention.intent}, type: ${intentMention.handlingType} for ${intentMention.tweetId || intentMention.id}`);
      await producer.send({
        topic: OUTPUT_TOPIC,
        messages: [{ value: JSON.stringify(intentMention) }],
      });
      // console.log(`IntentClassifier: Published intent-classified mention to ${OUTPUT_TOPIC}`);
    } else {
      console.warn('IntentClassifier: Intent classification returned no result for:', sentimentMention);
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
import { Kafka } from 'kafkajs';
import { extractAndAnalyzeMentions } from './scraper.js'

// Kafka configuration
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL || 'localhost:9092'; // Default to localhost if not set
const MENTIONS_TOPIC = 'mentions_topic'; // Define your Kafka topic for raw mentions
const CLIENT_ID = 'mention-analyzer-service';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: [KAFKA_BROKER_URL],
  retry: { // Add retry mechanism for robustness
    initialRetryTime: 300,
    retries: 5
  }
});

const producer = kafka.producer();
let isProducerConnected = false;

const connectProducer = async () => {
  if (isProducerConnected) return;
  try {
    await producer.connect();
    isProducerConnected = true;
    console.log(`Mention Analyzer Kafka producer connected to ${KAFKA_BROKER_URL}.`);
  } catch (error) {
    console.error('Failed to connect Kafka producer:', error);
    isProducerConnected = false;
    throw error; // Rethrow to indicate connection failure
  }
};

const disconnectProducer = async () => {
  if (!isProducerConnected) return;
  try {
    await producer.disconnect();
    isProducerConnected = false;
    console.log('Mention Analyzer Kafka producer disconnected.');
  } catch (error) {
    console.error('Failed to disconnect Kafka producer:', error);
  }
};

async function publishMention(mention) {
  if (!isProducerConnected) {
    console.warn('Producer not connected. Attempting to reconnect...');
    await connectProducer(); // Try to reconnect
    if (!isProducerConnected) {
      console.error('Failed to send message, producer still not connected.');
      return; // Skip sending if still not connected
    }
  }
  try {
    await producer.send({
      topic: MENTIONS_TOPIC,
      messages: [{ value: JSON.stringify(mention) }],
    });
  } catch (error) {
    console.error(`Error publishing mention (ID: ${mention.tweetId || mention.id}) to Kafka:`, error);
  }
}

// Main execution logic
async function main() {
  try {
    await connectProducer();

    // Example: Fetch mentions for a specific query
    const searchQuery = process.env.SEARCH_QUERY || "OpenAI"; // Use env var or default
    console.log(`Fetching mentions for query: "${searchQuery}"`);
    const fetchedMentions = await extractAndAnalyzeMentions(searchQuery);
    console.log(`Fetched ${fetchedMentions.length} mentions/profiles.`);

    if (fetchedMentions.length > 0) {
      console.log(`Publishing ${fetchedMentions.length} items to Kafka topic: ${MENTIONS_TOPIC}`);
      for (const mention of fetchedMentions) {
        const enrichedMention = {
          ...mention,
          brand: searchQuery, // Assuming the search query can represent the "brand"
          source: 'twitter_search', // Or 'x_search'
          fetchedAt: new Date().toISOString()
        };
        await publishMention(enrichedMention);
      }
      console.log("All fetched items processed for Kafka publishing.");
    } else {
      console.log("No mentions found for the query.");
    }

  } catch (error) {
    console.error("An error occurred in the Mention Analyzer main execution:", error);
  } finally {
    // In a real service, you might not disconnect immediately if it's a long-running process.
    // For this example, we disconnect after one run.
    // For a continuous service, producer should be disconnected on SIGINT/SIGTERM.
    // await disconnectProducer();
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down Mention Analyzer...`);
  await disconnectProducer();
  process.exit(0);
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Run the main function
main().catch(error => {
  console.error("Unhandled error in main execution:", error);
  process.exit(1);
});

export { publishMention, connectProducer, disconnectProducer };

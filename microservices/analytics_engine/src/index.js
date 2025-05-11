import pg from 'pg';
import { Kafka, logLevel } from 'kafkajs';

// Kafka Configuration
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL || 'localhost:9092';
const CONSUMER_GROUP_ID = 'analytics-engine-group';
const INPUT_TOPICS = ['mentions_topic', 'sentiment_classified_topic', 'intent_classified_topic'];
const CLIENT_ID = 'analytics-engine-service';

const kafka = new Kafka({
    clientId: CLIENT_ID,
    brokers: [KAFKA_BROKER_URL],
    logLevel: logLevel.INFO,
    retry: {
        initialRetryTime: 300,
        retries: 5
    }
});

const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
let isConsumerConnected = false;

// --- Database Setup ---
const { Pool } = pg;
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'analytics_db',
    password: process.env.PGPASSWORD || 'password',
    port: process.env.PGPORT || 5432,
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS mentions (
                id SERIAL PRIMARY KEY,
                tweet_id VARCHAR(255) UNIQUE NOT NULL,
                brand VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                tweet_text TEXT,
                sentiment VARCHAR(50),
                intent VARCHAR(100),
                intent_type VARCHAR(100),
                platform VARCHAR(100),
                author_id VARCHAR(255),
                keywords TEXT[],
                raw_data JSONB,
                processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_brand_created_at ON mentions (brand, created_at DESC);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_sentiment ON mentions (sentiment);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_intent ON mentions (intent);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_keywords ON mentions USING GIN (keywords);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_mentions_processed_at ON mentions (processed_at DESC);`);
    } catch (err) {
        console.error("Error initializing database:", err);
        throw err;
    } finally {
        client.release();
    }
};

initializeDatabase().catch(err => {
    console.error("Failed to initialize database on startup:", err);
});

// --- Helper Functions (SQL specific) ---
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must', 'i', 'me', 'my', 'myself', 'we', 'us',
    'our', 'ourselves', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they',
    'them', 'their', 'theirs', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'at', 'by', 'for', 'from', 'in', 'into', 'on', 'onto', 'of', 'over',
    'to', 'under', 'up', 'with', 'and', 'but', 'or', 'so', 'if', 'because', 'as', 'until', 'while', 'of', 'at',
    'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'rt',
]);

const extractKeywords = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.toLowerCase()
        .replace(/[.,!?;:"'`]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word) && !word.startsWith('@') && !word.startsWith('#') && !word.startsWith('http'));
};

// --- Exported Functions ---
export const recordMentionEvent = async (eventData) => {
    if (!eventData || !eventData.tweetId || !eventData.createdAt || !eventData.brand) {
        return { success: false, error: "Invalid eventData: tweetId, createdAt, and brand are required." };
    }
    try {
        new Date(eventData.createdAt).toISOString();
    } catch (e) {
        return { success: false, error: "Invalid eventData: createdAt is not a valid ISO date string." };
    }

    const {
        tweetId,
        brand,
        createdAt,
        tweetText,
        sentiment,
        intent,
        handlingType,
        intentType,
        platform,
        authorId,
        ...rest
    } = eventData;

    const finalIntentType = intentType || handlingType;
    const keywords = extractKeywords(tweetText);

    const query = `
        INSERT INTO mentions (
            tweet_id, brand, created_at, tweet_text, sentiment, intent, intent_type, platform, author_id, keywords, raw_data, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (tweet_id) DO UPDATE SET
            tweet_text = COALESCE(EXCLUDED.tweet_text, mentions.tweet_text),
            sentiment = COALESCE(EXCLUDED.sentiment, mentions.sentiment),
            intent = COALESCE(EXCLUDED.intent, mentions.intent),
            intent_type = COALESCE(EXCLUDED.intent_type, mentions.intent_type),
            platform = COALESCE(EXCLUDED.platform, mentions.platform),
            author_id = COALESCE(EXCLUDED.author_id, mentions.author_id),
            keywords = COALESCE(EXCLUDED.keywords, mentions.keywords),
            raw_data = mentions.raw_data || EXCLUDED.raw_data,
            processed_at = CURRENT_TIMESTAMP
        WHERE mentions.tweet_id = $1
        RETURNING id, (xmax = 0) AS inserted;
    `;

    const values = [
        tweetId, brand, createdAt, tweetText, sentiment, intent, finalIntentType,
        platform, authorId, keywords, JSON.stringify(rest)
    ];

    try {
        const res = await pool.query(query, values);
        if (res.rows.length > 0) {
            const wasInserted = res.rows[0].inserted;
            return {
                success: true,
                eventId: tweetId,
                dbId: res.rows[0].id,
                operation: wasInserted ? "inserted" : "updated"
            };
        }
        console.warn("Event neither inserted nor updated, check logic:", tweetId);
        return { success: true, eventId: tweetId, message: "Event processed, no change in DB state or unexpected result." };
    } catch (err) {
        console.error("Error recording/updating mention event:", err);
        console.error("Offending eventData:", eventData);
        return { success: false, error: "Database error while recording/updating event." };
    }
};

const processMessage = async (messageValue, topic) => {
    try {
        const eventData = JSON.parse(messageValue.toString());
        if (!eventData.raw_data) eventData.raw_data = {};
        eventData.raw_data.source_topic = topic;

        if (topic === 'mentions_topic' && (!eventData.brand || !eventData.createdAt || !eventData.tweetId)) {
            console.warn("Skipping incomplete message from mentions_topic:", eventData);
            return;
        }

        if (eventData.createdAt && isNaN(new Date(eventData.createdAt).getTime())) {
            console.warn("Invalid createdAt date in message from", topic, "attempting to parse or skipping:", eventData);
        }

        const result = await recordMentionEvent(eventData);

        if (result.success) {
            // console.log(`Successfully ${result.operation || 'processed'} event ${result.eventId} from ${topic}`);
        } else {
            console.error(`Failed to process event ${eventData.tweetId || eventData.id} from ${topic}: ${result.error}`);
        }
    } catch (error) {
        console.error(`Error processing message from ${topic}:`, error);
        console.error(`Offending message value from ${topic}:`, messageValue.toString());
    }
};

const runKafkaConsumer = async () => {
    try {
        await consumer.connect();
        isConsumerConnected = true;
        console.log(`Consumer connected to ${KAFKA_BROKER_URL}, group ${CONSUMER_GROUP_ID}`);

        for (const topic of INPUT_TOPICS) {
            await consumer.subscribe({ topic, fromBeginning: true });
            console.log(`Subscribed to topic ${topic}`);
        }

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                await processMessage(message.value, topic);
            },
        });
    } catch (error) {
        console.error("Error in Kafka consumer setup or run:", error);
        await shutdownKafka();
        process.exit(1);
    }
};

const shutdownKafka = async () => {
    console.log("Shutting down Kafka consumer...");
    try {
        if (isConsumerConnected) {
            await consumer.disconnect();
            isConsumerConnected = false;
            console.log("Kafka consumer disconnected.");
        }
    } catch (error) {
        console.error("Error disconnecting Kafka consumer:", error);
    }
};

const gracefulKafkaShutdown = async (signal) => {
    console.log(`Received ${signal}. Initiating Kafka shutdown.`);
    await shutdownKafka();
};

const main = async () => {
    try {
        await initializeDatabase();
        console.log("Database initialization complete.");

        await runKafkaConsumer();
        console.log("Kafka consumer started.");
    } catch (error) {
        console.error("Failed to start application:", error);
        await shutdownKafka();
        process.exit(1);
    }
};

const shutdownApplication = async (signal) => {
    console.log(`Received ${signal}. Shutting down application...`);
    await shutdownKafka();
    try {
        await pool.end();
        console.log("PostgreSQL pool has been closed.");
    } catch (err) {
        console.error("Error closing PostgreSQL pool:", err);
    }
    process.exit(0);
};

process.on('SIGINT', () => shutdownApplication('SIGINT'));
process.on('SIGTERM', () => shutdownApplication('SIGTERM'));

main().catch(async e => {
    console.error("Unhandled error during main execution:", e);
    await shutdownApplication('UnhandledError');
    process.exit(1);
});

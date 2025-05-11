-- Create tickets table for response_generator_service
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255), -- Added user_id
    tweet_text TEXT,       -- Renamed from content to tweet_text
    tweet_url VARCHAR(1024) NOT NULL,
    intent VARCHAR(100),   -- Added intent
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create mentions table for analytics_engine
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

-- Add indexes for mentions table (from analytics_engine/src/index.js)
CREATE INDEX IF NOT EXISTS idx_mentions_brand_created_at ON mentions (brand, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_sentiment ON mentions (sentiment);
CREATE INDEX IF NOT EXISTS idx_mentions_intent ON mentions (intent);
CREATE INDEX IF NOT EXISTS idx_mentions_keywords ON mentions USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_mentions_processed_at ON mentions (processed_at DESC);

-- Drop and recreate sentiment_analysis_results table
-- Note: analytics_engine currently does not populate this table. Dashboard might use it.
CREATE TABLE IF NOT EXISTS sentiment_analysis_results (
    id SERIAL PRIMARY KEY,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    sentiment_score FLOAT,
    sentiment_label VARCHAR(50), -- e.g., positive, negative, neutral
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create intent_analysis_results table for analytics_engine
CREATE TABLE IF NOT EXISTS intent_analysis_results (
    id SERIAL PRIMARY KEY,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    intent_label VARCHAR(100), -- e.g., complaint, query, feedback, compliment
    confidence_score FLOAT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- You can add more tables or refine these as needed.

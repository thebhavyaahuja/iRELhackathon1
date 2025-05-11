import streamlit as st
import psycopg2
import pandas as pd
import os
import time

# Database connection parameters - fetched from environment variables
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME_ANALYTICS", "analytics_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgrespassword")
DB_PORT = os.getenv("DB_PORT", "5432")

@st.cache_resource(ttl=30) # Cache the connection for 30 seconds
def get_db_connection():
    max_retries = 5
    retry_delay = 5 # seconds
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=DB_HOST,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                port=DB_PORT
            )
            st.sidebar.success("DB Connected (attempt {}/{})".format(attempt + 1, max_retries))
            return conn
        except psycopg2.OperationalError as e:
            st.sidebar.warning(f"DB connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                st.sidebar.error(f"Failed to connect to database after {max_retries} attempts.")
                st.error(f"Application Error: Could not connect to the database: {e}")
                return None

@st.cache_data(ttl=60) # Cache data for 60 seconds
def fetch_data(query, params=None):
    conn = get_db_connection()
    if conn:
        try:
            # Check if the connection is closed before attempting to use it
            if hasattr(conn, 'closed') and conn.closed:
                st.warning("Attempting to use a closed connection. Clearing resource cache and retrying.")
                st.cache_resource.clear() # Clear the connection cache
                conn = get_db_connection() # Get a new connection
                if not conn or (hasattr(conn, 'closed') and conn.closed):
                    st.error("Failed to re-establish a valid database connection.")
                    return pd.DataFrame()

            with conn.cursor() as cur:
                cur.execute(query, params)
                if cur.description:
                    colnames = [desc[0] for desc in cur.description]
                    df = pd.DataFrame(cur.fetchall(), columns=colnames)
                    return df
                return None # For queries like UPDATE/INSERT without RETURNING
        except psycopg2.Error as e:
            st.error(f"Database query error: {e}")
            # Invalidate connection cache if specific errors occur that might indicate a stale connection
            if "server closed the connection unexpectedly" in str(e) or \
               "connection already closed" in str(e) or \
               "terminating connection due to administrator command" in str(e) or \
               (hasattr(conn, 'closed') and conn.closed): # Also clear if we find it closed here
                st.cache_resource.clear() # Clears all resource caches, including get_db_connection
            return pd.DataFrame() # Return empty DataFrame on error
    return pd.DataFrame()

st.set_page_config(page_title="Social Media Dashboard", layout="wide")

st.title("Social Media Analytics & Ticketing Dashboard")

# Auto-refresh mechanism
if 'last_refresh_time' not in st.session_state:
    st.session_state.last_refresh_time = time.time()

refresh_interval = 60  # seconds
if time.time() - st.session_state.last_refresh_time > refresh_interval:
    st.session_state.last_refresh_time = time.time()
    st.cache_data.clear() # Clear data caches
    st.cache_resource.clear() # Clear resource caches (like DB connection)
    st.rerun()

st.sidebar.button("Refresh Data") # Manual refresh button

# --- Analytics Section ---
st.header("Social Media Analytics")

# Create three columns for the analytics charts
col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Mentions Over Time")
    # Query directly from the 'mentions' table and aggregate
    try:
        # Aggregate mentions by hour. Adjust DATE_TRUNC for different granularities (day, week, etc.)
        mentions_query = """
            SELECT 
                DATE_TRUNC('hour', created_at) AS time_bucket,
                COUNT(id) AS mention_count
            FROM mentions
            GROUP BY time_bucket
            ORDER BY time_bucket DESC
            LIMIT 100;
        """
        mentions_df = fetch_data(mentions_query)
        if not mentions_df.empty and 'time_bucket' in mentions_df.columns and 'mention_count' in mentions_df.columns:
            mentions_df = mentions_df.set_index('time_bucket')
            st.line_chart(mentions_df['mention_count'])
        elif not mentions_df.empty:
            st.warning("Mentions data retrieved, but columns 'time_bucket' or 'mention_count' are missing from the aggregation.")
            st.dataframe(mentions_df)
        else:
            st.info("No mention data found in the 'mentions' table yet.")
    except Exception as e:
        st.error(f"Could not load mentions data: {e}")


with col2:
    st.subheader("Sentiment Distribution")
    # Query directly from the 'mentions' table and aggregate
    try:
        sentiment_query = """
            SELECT 
                sentiment,
                COUNT(id) AS sentiment_count
            FROM mentions
            WHERE sentiment IS NOT NULL
            GROUP BY sentiment
            ORDER BY sentiment_count DESC;
        """
        sentiment_df = fetch_data(sentiment_query)
        if not sentiment_df.empty and 'sentiment' in sentiment_df.columns and 'sentiment_count' in sentiment_df.columns:
            # Define a color map for sentiments
            sentiment_color_map = {
                'negative': '#F44336',  # Red
                'positive': '#4CAF50',  # Green
                'neutral': '#FFC107'   # Amber
            }
            # Add a 'bar_color' column to the DataFrame
            sentiment_df['bar_color'] = sentiment_df['sentiment'].apply(lambda s: sentiment_color_map.get(s, '#808080')) # Default to gray
            
            # Plot, using the 'bar_color' column for coloring
            st.bar_chart(sentiment_df.set_index('sentiment'), y='sentiment_count', color='bar_color')

        elif not sentiment_df.empty:
            st.warning("Sentiment data retrieved, but columns 'sentiment' or 'sentiment_count' are missing from the aggregation.")
            st.dataframe(sentiment_df)
        else:
            st.info("No sentiment data found in the 'mentions' table yet or all sentiments are NULL.")
    except Exception as e:
        st.error(f"Could not load sentiment data: {e}")

with col3:
    st.subheader("Intent Distribution")
    # Query directly from the 'mentions' table and aggregate for intent
    try:
        intent_query = """
            SELECT 
                intent,
                COUNT(id) AS intent_count
            FROM mentions
            WHERE intent IS NOT NULL
            GROUP BY intent
            ORDER BY intent_count DESC;
        """
        intent_df = fetch_data(intent_query)
        if not intent_df.empty and 'intent' in intent_df.columns and 'intent_count' in intent_df.columns:
            # Define a basic color palette
            intent_colors_palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
            
            # Add a 'bar_color' column to the DataFrame
            intent_df['bar_color'] = [intent_colors_palette[i % len(intent_colors_palette)] for i in range(len(intent_df))]
            
            # Plot, using the 'bar_color' column
            st.bar_chart(intent_df.set_index('intent'), y='intent_count', color='bar_color')
            
        elif not intent_df.empty:
            st.warning("Intent data retrieved, but columns 'intent' or 'intent_count' are missing from the aggregation.")
            st.dataframe(intent_df)
        else:
            st.info("No intent data found in the 'mentions' table yet or all intents are NULL.")
    except Exception as e:
        st.error(f"Could not load intent data: {e}")

# --- Ticketing Section ---
st.header("Open Support Tickets")

# Assuming response_generator creates/updates a 'tickets' table
# with columns: id, tweet_id, user_id, tweet_text, tweet_url, intent, status, created_at, updated_at
try:
    tickets_df = fetch_data("SELECT id, tweet_url, tweet_text, intent, status, created_at FROM tickets WHERE status = 'open' ORDER BY created_at DESC;")
    if not tickets_df.empty:
        st.dataframe(tickets_df, use_container_width=True)
    else:
        st.info("No open tickets found or table 'tickets' does not exist yet.")
except Exception as e:
    st.error(f"Could not load tickets data: {e}")

st.sidebar.markdown("---_" * 10)
st.sidebar.markdown(f"Last refresh: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(st.session_state.last_refresh_time))}")

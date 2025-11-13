-- TimescaleDB initialization script for euroscope2mcp
-- Option 1: Hybrid Schema (Optimized for VATSIM FSD Protocol)
--
-- Strategy:
-- - Dedicated 'positions' table for high-frequency position updates (80-90% of traffic)
-- - Generic 'messages' table with JSONB for all other message types (flexible schema)
-- - Hypertables for automatic time-based partitioning
-- - Retention and compression policies for efficient storage

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- POSITIONS TABLE (High-frequency, structured data)
-- =============================================================================
-- Handles: @S: (slow) and @N: (fast) position updates
-- These make up 80-90% of all VATSIM traffic

CREATE TABLE positions (
    time TIMESTAMPTZ NOT NULL,
    port INTEGER NOT NULL,
    callsign VARCHAR(20) NOT NULL,

    -- Position data
    squawk VARCHAR(4),
    rating INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude INTEGER,
    ground_speed INTEGER,

    -- Orientation (Pitch/Bank/Heading packed as string: "pitch:bank:heading")
    pbh VARCHAR(50),

    -- Flags (integer representing various state flags)
    flags INTEGER,

    -- Message type for filtering
    message_type VARCHAR(20) NOT NULL,  -- 'POSITION_FAST' or 'POSITION_SLOW'

    -- Raw message for reference
    raw_message TEXT
);

-- Convert to hypertable (partitioned by time)
SELECT create_hypertable('positions', 'time');

-- Create indexes for common queries
CREATE INDEX idx_positions_callsign_time ON positions (callsign, time DESC);
CREATE INDEX idx_positions_port ON positions (port, time DESC);
CREATE INDEX idx_positions_type ON positions (message_type, time DESC);

-- Retention policy: keep position data for 7 days
SELECT add_retention_policy('positions', INTERVAL '7 days');

-- =============================================================================
-- MESSAGES TABLE (Low-frequency, flexible data)
-- =============================================================================
-- Handles: Flight plans, text messages, controller positions, auth, etc.
-- These are 10-20% of traffic but contain richer data

CREATE TABLE messages (
    time TIMESTAMPTZ NOT NULL,
    port INTEGER NOT NULL,

    -- Message classification
    message_type VARCHAR(50) NOT NULL,

    -- Primary identifier (callsign, from field, etc.)
    callsign VARCHAR(20),

    -- Structured data (JSONB for flexibility)
    data JSONB NOT NULL,

    -- Raw message for reference
    raw_message TEXT NOT NULL
);

-- Convert to hypertable
SELECT create_hypertable('messages', 'time');

-- Create indexes
CREATE INDEX idx_messages_callsign_time ON messages (callsign, time DESC);
CREATE INDEX idx_messages_type_time ON messages (message_type, time DESC);
CREATE INDEX idx_messages_port ON messages (port, time DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_messages_data_gin ON messages USING GIN (data);

-- Retention policy: keep message data for 30 days
SELECT add_retention_policy('messages', INTERVAL '30 days');

-- =============================================================================
-- HELPFUL VIEWS
-- =============================================================================

-- Recent positions (last hour)
CREATE OR REPLACE VIEW recent_positions AS
SELECT * FROM positions
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Recent messages (last hour)
CREATE OR REPLACE VIEW recent_messages AS
SELECT * FROM messages
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Active aircraft (last 5 minutes)
CREATE OR REPLACE VIEW active_aircraft AS
SELECT DISTINCT ON (callsign)
    callsign,
    time,
    latitude,
    longitude,
    altitude,
    ground_speed,
    squawk
FROM positions
WHERE time > NOW() - INTERVAL '5 minutes'
ORDER BY callsign, time DESC;

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO euroscope;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO euroscope;

-- =============================================================================
-- SAMPLE QUERIES (for reference)
-- =============================================================================

-- Get flight path for specific callsign
-- SELECT time, latitude, longitude, altitude, ground_speed
-- FROM positions
-- WHERE callsign = 'BAW42Y'
--   AND time > NOW() - INTERVAL '1 hour'
-- ORDER BY time DESC;

-- Get all clearances for a callsign
-- SELECT time, message_type, data
-- FROM messages
-- WHERE callsign = 'UAL21E'
--   AND message_type = 'TEXT_MESSAGE'
--   AND time > NOW() - INTERVAL '24 hours'
-- ORDER BY time DESC;

-- Find aircraft in specific area (bounding box)
-- SELECT DISTINCT ON (callsign) callsign, time, latitude, longitude, altitude
-- FROM positions
-- WHERE time > NOW() - INTERVAL '5 minutes'
--   AND latitude BETWEEN 51.0 AND 52.0
--   AND longitude BETWEEN -1.0 AND 0.0
-- ORDER BY callsign, time DESC;

-- Get flight plan data
-- SELECT time, callsign,
--        data->>'departure' as departure,
--        data->>'destination' as destination,
--        data->>'route' as route
-- FROM messages
-- WHERE message_type = 'FLIGHT_PLAN'
--   AND callsign = 'UAL21E'
-- ORDER BY time DESC
-- LIMIT 1;

-- Statistics: messages per type in last hour
-- SELECT message_type, COUNT(*) as count
-- FROM messages
-- WHERE time > NOW() - INTERVAL '1 hour'
-- GROUP BY message_type
-- ORDER BY count DESC;

-- Statistics: position updates per callsign
-- SELECT callsign, COUNT(*) as update_count,
--        MAX(time) as last_seen,
--        AVG(altitude) as avg_altitude,
--        AVG(ground_speed) as avg_speed
-- FROM positions
-- WHERE time > NOW() - INTERVAL '1 hour'
-- GROUP BY callsign
-- ORDER BY update_count DESC;

-- Message frequency over time (5-minute buckets)
-- SELECT time_bucket('5 minutes', time) AS bucket,
--        message_type,
--        COUNT(*) as count
-- FROM messages
-- WHERE time > NOW() - INTERVAL '24 hours'
-- GROUP BY bucket, message_type
-- ORDER BY bucket DESC, count DESC;

-- Position update frequency (1-minute buckets)
-- SELECT time_bucket('1 minute', time) AS bucket,
--        COUNT(*) as position_updates
-- FROM positions
-- WHERE time > NOW() - INTERVAL '1 hour'
-- GROUP BY bucket
-- ORDER BY bucket DESC;

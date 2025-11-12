-- init.sql
-- TimescaleDB initialization script for euroscope2mcp

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Main messages table (all raw messages)
CREATE TABLE IF NOT EXISTS messages (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  message_type VARCHAR(50),
  parser_name VARCHAR(50),
  raw_message TEXT,
  parsed_data JSONB,
  metadata JSONB
);

-- Convert to hypertable (TimescaleDB time-series optimization)
SELECT create_hypertable('messages', 'time', if_not_exists => TRUE);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_port_time ON messages(port, time DESC);
CREATE INDEX IF NOT EXISTS idx_messages_type_time ON messages(message_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parser ON messages(parser_name, time DESC);
CREATE INDEX IF NOT EXISTS idx_parsed_data ON messages USING GIN(parsed_data);

-- Positions table (high-frequency position updates)
CREATE TABLE IF NOT EXISTS positions (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  callsign VARCHAR(20) NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude INTEGER,
  ground_speed INTEGER,
  heading INTEGER,
  squawk VARCHAR(4),
  rating INTEGER
);

SELECT create_hypertable('positions', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_positions_callsign ON positions(callsign, time DESC);
CREATE INDEX IF NOT EXISTS idx_positions_port ON positions(port, time DESC);

-- Flight plans table
CREATE TABLE IF NOT EXISTS flight_plans (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  callsign VARCHAR(20) NOT NULL,
  flight_plan_data TEXT,
  parsed_data JSONB
);

SELECT create_hypertable('flight_plans', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_flight_plans_callsign ON flight_plans(callsign, time DESC);

-- Text messages table (clearances, communications)
CREATE TABLE IF NOT EXISTS text_messages (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  from_callsign VARCHAR(20),
  to_callsign VARCHAR(20),
  message_text TEXT
);

SELECT create_hypertable('text_messages', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_text_from ON text_messages(from_callsign, time DESC);
CREATE INDEX IF NOT EXISTS idx_text_to ON text_messages(to_callsign, time DESC);

-- Controller positions table
CREATE TABLE IF NOT EXISTS controller_positions (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  callsign VARCHAR(20) NOT NULL,
  frequency VARCHAR(10),
  facility INTEGER,
  visual_range INTEGER,
  rating INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

SELECT create_hypertable('controller_positions', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_controllers_callsign ON controller_positions(callsign, time DESC);

-- Capture statistics table (per-port metrics)
CREATE TABLE IF NOT EXISTS capture_stats (
  time TIMESTAMPTZ NOT NULL,
  port INTEGER NOT NULL,
  message_count INTEGER,
  bytes_received BIGINT,
  parser_name VARCHAR(50),
  messages_per_second DOUBLE PRECISION
);

SELECT create_hypertable('capture_stats', 'time', if_not_exists => TRUE);

-- Retention policies (optional - comment out if you want to keep all data)
-- Keep raw messages for 30 days
SELECT add_retention_policy('messages', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep positions for 7 days (high frequency data)
SELECT add_retention_policy('positions', INTERVAL '7 days', if_not_exists => TRUE);

-- Keep flight plans for 30 days
SELECT add_retention_policy('flight_plans', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep text messages for 30 days
SELECT add_retention_policy('text_messages', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep controller positions for 7 days
SELECT add_retention_policy('controller_positions', INTERVAL '7 days', if_not_exists => TRUE);

-- Keep stats for 90 days
SELECT add_retention_policy('capture_stats', INTERVAL '90 days', if_not_exists => TRUE);

-- Compression policies (optional - saves disk space)
-- Compress messages older than 7 days
SELECT add_compression_policy('messages', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('positions', INTERVAL '1 day', if_not_exists => TRUE);
SELECT add_compression_policy('flight_plans', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('text_messages', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('controller_positions', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_compression_policy('capture_stats', INTERVAL '7 days', if_not_exists => TRUE);

-- Create views for easy querying
CREATE OR REPLACE VIEW recent_positions AS
SELECT * FROM positions
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

CREATE OR REPLACE VIEW recent_messages AS
SELECT * FROM messages
WHERE time > NOW() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO euroscope;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO euroscope;

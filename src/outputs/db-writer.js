/**
 * db-writer.js
 * TimescaleDB writer with batching support
 * Updated for Hybrid Schema (Option 1)
 */

const { Pool } = require('pg');

/**
 * Create database writer instance
 */
function createDbWriter(config) {
  const dbConfig = config.outputs.database;

  if (!dbConfig.enabled) {
    return null;
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    host: dbConfig.host || 'localhost',
    port: dbConfig.port || 5432,
    database: dbConfig.database || 'euroscope',
    user: dbConfig.user || 'euroscope',
    password: dbConfig.password || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Batching configuration
  const batchSize = dbConfig.batchSize || 100;
  const flushInterval = dbConfig.flushInterval || 1000;

  // Buffers for the hybrid schema (positions + messages)
  const buffers = {
    positions: [],
    messages: []
  };

  let flushTimer = null;
  let stats = {
    totalWritten: 0,
    errorCount: 0,
    lastFlushTime: Date.now()
  };

  /**
   * Initialize database writer
   */
  async function init() {
    try {
      // Test connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection established');

      // Start flush timer
      startFlushTimer();
    } catch (err) {
      console.error('Database connection error:', err.message);
      throw err;
    }
  }

  /**
   * Write message to database
   */
  async function write(message) {
    try {
      // Route to appropriate buffer based on message type
      if (message.type === 'POSITION_FAST' || message.type === 'POSITION_SLOW') {
        buffers.positions.push(message);
      } else {
        // Everything else goes to messages table
        buffers.messages.push(message);
      }

      // Check if we need to flush
      const totalBuffered = buffers.positions.length + buffers.messages.length;
      if (totalBuffered >= batchSize) {
        await flush();
      }
    } catch (err) {
      stats.errorCount++;
      console.error('Error queuing message:', err.message);
    }
  }

  /**
   * Flush all buffers to database
   */
  async function flush() {
    // Quick check if there's anything to flush
    if (buffers.positions.length === 0 && buffers.messages.length === 0) {
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Flush positions
      if (buffers.positions.length > 0) {
        await flushPositions(client, buffers.positions);
        stats.totalWritten += buffers.positions.length;
        buffers.positions = [];
      }

      // Flush messages
      if (buffers.messages.length > 0) {
        await flushMessages(client, buffers.messages);
        stats.totalWritten += buffers.messages.length;
        buffers.messages = [];
      }

      await client.query('COMMIT');
      stats.lastFlushTime = Date.now();
    } catch (err) {
      await client.query('ROLLBACK');
      stats.errorCount++;
      console.error('Error flushing to database:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Flush positions to positions table
   * Schema: time, port, callsign, squawk, rating, latitude, longitude,
   *         altitude, ground_speed, pbh, flags, message_type, raw_message
   */
  async function flushPositions(client, positions) {
    if (positions.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    positions.forEach(msg => {
      if (!msg.parsed) return;

      const p = msg.parsed;
      values.push('(' + '$' + paramIndex + ', $' + (paramIndex + 1) + ', $' + (paramIndex + 2) + ', $' + (paramIndex + 3) + ', $' + (paramIndex + 4) + ', $' + (paramIndex + 5) + ', $' + (paramIndex + 6) + ', $' + (paramIndex + 7) + ', $' + (paramIndex + 8) + ', $' + (paramIndex + 9) + ', $' + (paramIndex + 10) + ', $' + (paramIndex + 11) + ', $' + (paramIndex + 12) + ')');
      params.push(
        new Date(msg.timestamp),
        msg.port,
        p.callsign || '',
        p.squawk || null,
        p.rating || null,
        p.latitude || null,
        p.longitude || null,
        p.altitude || null,
        p.groundSpeed || null,
        p.pbh || null,
        p.flags ? parseInt(p.flags) : null,
        msg.type,
        msg.raw
      );
      paramIndex += 13;
    });

    if (values.length === 0) return;

    const query = 'INSERT INTO positions (time, port, callsign, squawk, rating, latitude, longitude, altitude, ground_speed, pbh, flags, message_type, raw_message) VALUES ' + values.join(',');

    await client.query(query, params);
  }

  /**
   * Flush messages to messages table
   * Schema: time, port, message_type, callsign, data, raw_message
   */
  async function flushMessages(client, messages) {
    if (messages.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    messages.forEach(msg => {
      // Extract callsign from parsed data (different fields for different message types)
      let callsign = null;
      if (msg.parsed) {
        if (msg.parsed.callsign) {
          callsign = msg.parsed.callsign;
        } else if (msg.parsed.from) {
          callsign = msg.parsed.from;
        }
      }

      // Store all parsed data as JSONB
      const data = msg.parsed || {};

      values.push('(' + '$' + paramIndex + ', $' + (paramIndex + 1) + ', $' + (paramIndex + 2) + ', $' + (paramIndex + 3) + ', $' + (paramIndex + 4) + ', $' + (paramIndex + 5) + ')');
      params.push(
        new Date(msg.timestamp),
        msg.port,
        msg.type,
        callsign,
        JSON.stringify(data),
        msg.raw
      );
      paramIndex += 6;
    });

    if (values.length === 0) return;

    const query = 'INSERT INTO messages (time, port, message_type, callsign, data, raw_message) VALUES ' + values.join(',');

    await client.query(query, params);
  }

  /**
   * Start automatic flush timer
   */
  function startFlushTimer() {
    flushTimer = setInterval(async () => {
      try {
        await flush();
      } catch (err) {
        // Errors already logged in flush()
      }
    }, flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  function stopFlushTimer() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * Close database connection
   */
  async function close() {
    stopFlushTimer();

    // Flush remaining data
    try {
      await flush();
    } catch (err) {
      console.error('Error flushing on close:', err.message);
    }

    await pool.end();
  }

  /**
   * Get statistics
   */
  function getStats() {
    return {
      ...stats,
      bufferedPositions: buffers.positions.length,
      bufferedMessages: buffers.messages.length
    };
  }

  return {
    init,
    write,
    flush,
    close,
    getStats
  };
}

module.exports = { createDbWriter };

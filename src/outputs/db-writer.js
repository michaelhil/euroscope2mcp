/**
 * db-writer.js
 * TimescaleDB writer with batching support
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

  // Buffers for different message types
  const buffers = {
    messages: [],
    positions: [],
    flightPlans: [],
    textMessages: [],
    controllerPositions: []
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
      // Add to general messages buffer
      buffers.messages.push(message);

      // Add to specific buffers based on type
      if (message.type === 'POSITION_FAST' || message.type === 'POSITION_SLOW') {
        buffers.positions.push(message);
      } else if (message.type === 'FLIGHT_PLAN') {
        buffers.flightPlans.push(message);
      } else if (message.type === 'TEXT_MESSAGE') {
        buffers.textMessages.push(message);
      } else if (message.type === 'CONTROLLER_POSITION') {
        buffers.controllerPositions.push(message);
      }

      // Check if we need to flush
      if (buffers.messages.length >= batchSize) {
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
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Flush messages
      if (buffers.messages.length > 0) {
        await flushMessages(client, buffers.messages);
        buffers.messages = [];
      }

      // Flush positions
      if (buffers.positions.length > 0) {
        await flushPositions(client, buffers.positions);
        buffers.positions = [];
      }

      // Flush flight plans
      if (buffers.flightPlans.length > 0) {
        await flushFlightPlans(client, buffers.flightPlans);
        buffers.flightPlans = [];
      }

      // Flush text messages
      if (buffers.textMessages.length > 0) {
        await flushTextMessages(client, buffers.textMessages);
        buffers.textMessages = [];
      }

      // Flush controller positions
      if (buffers.controllerPositions.length > 0) {
        await flushControllerPositions(client, buffers.controllerPositions);
        buffers.controllerPositions = [];
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
   * Flush messages to messages table
   */
  async function flushMessages(client, messages) {
    if (messages.length === 0) return;

    const values = messages.map((msg, idx) => {
      const params = [
        new Date(msg.timestamp),
        msg.port,
        msg.type,
        msg.parserName,
        msg.raw,
        JSON.stringify(msg.parsed),
        JSON.stringify({ parserName: msg.parserName })
      ];
      const offset = idx * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(',');

    const allParams = messages.flatMap(msg => [
      new Date(msg.timestamp),
      msg.port,
      msg.type,
      msg.parserName,
      msg.raw,
      JSON.stringify(msg.parsed),
      JSON.stringify({ parserName: msg.parserName })
    ]);

    const query = `
      INSERT INTO messages (time, port, message_type, parser_name, raw_message, parsed_data, metadata)
      VALUES ${values}
    `;

    await client.query(query, allParams);
    stats.totalWritten += messages.length;
  }

  /**
   * Flush positions to positions table
   */
  async function flushPositions(client, positions) {
    if (positions.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    positions.forEach(msg => {
      if (!msg.parsed) return;

      const p = msg.parsed;
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})`);
      params.push(
        new Date(msg.timestamp),
        msg.port,
        p.callsign || '',
        p.latitude || 0,
        p.longitude || 0,
        p.altitude || 0,
        p.groundSpeed || 0,
        0, // heading (not in current parser)
        p.squawk || '',
        p.rating || 0
      );
      paramIndex += 10;
    });

    if (values.length === 0) return;

    const query = `
      INSERT INTO positions (time, port, callsign, latitude, longitude, altitude, ground_speed, heading, squawk, rating)
      VALUES ${values.join(',')}
    `;

    await client.query(query, params);
  }

  /**
   * Flush flight plans to flight_plans table
   */
  async function flushFlightPlans(client, flightPlans) {
    if (flightPlans.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    flightPlans.forEach(msg => {
      if (!msg.parsed) return;

      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      params.push(
        new Date(msg.timestamp),
        msg.port,
        msg.parsed.callsign || '',
        msg.parsed.data || '',
        JSON.stringify(msg.parsed)
      );
      paramIndex += 5;
    });

    if (values.length === 0) return;

    const query = `
      INSERT INTO flight_plans (time, port, callsign, flight_plan_data, parsed_data)
      VALUES ${values.join(',')}
    `;

    await client.query(query, params);
  }

  /**
   * Flush text messages to text_messages table
   */
  async function flushTextMessages(client, textMessages) {
    if (textMessages.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    textMessages.forEach(msg => {
      if (!msg.parsed) return;

      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      params.push(
        new Date(msg.timestamp),
        msg.port,
        msg.parsed.from || '',
        msg.parsed.to || '',
        msg.parsed.message || ''
      );
      paramIndex += 5;
    });

    if (values.length === 0) return;

    const query = `
      INSERT INTO text_messages (time, port, from_callsign, to_callsign, message_text)
      VALUES ${values.join(',')}
    `;

    await client.query(query, params);
  }

  /**
   * Flush controller positions to controller_positions table
   */
  async function flushControllerPositions(client, controllers) {
    if (controllers.length === 0) return;

    const values = [];
    const params = [];
    let paramIndex = 1;

    controllers.forEach(msg => {
      if (!msg.parsed) return;

      const p = msg.parsed;
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`);
      params.push(
        new Date(msg.timestamp),
        msg.port,
        p.callsign || '',
        p.frequency || '',
        p.facility || 0,
        p.visualRange || 0,
        p.rating || 0,
        p.latitude || 0,
        p.longitude || 0
      );
      paramIndex += 9;
    });

    if (values.length === 0) return;

    const query = `
      INSERT INTO controller_positions (time, port, callsign, frequency, facility, visual_range, rating, latitude, longitude)
      VALUES ${values.join(',')}
    `;

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
      bufferedMessages: buffers.messages.length,
      bufferedPositions: buffers.positions.length,
      bufferedFlightPlans: buffers.flightPlans.length,
      bufferedTextMessages: buffers.textMessages.length,
      bufferedControllerPositions: buffers.controllerPositions.length
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

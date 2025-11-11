/**
 * fsd-parser.js
 * Parser for FSD (Flight Simulator Display) protocol messages
 */

const EventEmitter = require('events');

/**
 * Identify message type from FSD message
 * @param {string} message - Raw FSD message
 * @returns {string} Message type identifier
 */
function identifyMessageType(message) {
  if (!message || message.length === 0) return 'UNKNOWN';

  if (message.startsWith('@S:')) return 'POSITION_SLOW';
  if (message.startsWith('@N:')) return 'POSITION_FAST';
  if (message.startsWith('$FP')) return 'FLIGHT_PLAN';
  if (message.startsWith('$CQ')) return 'CLIENT_QUERY';
  if (message.startsWith('#TM')) return 'TEXT_MESSAGE';
  if (message.startsWith('#PC')) return 'PILOT_CLIENT';
  if (message.startsWith('#AP')) return 'AUTH_PILOT';
  if (message.startsWith('#ST')) return 'POSITION_TRANSMISSION';
  if (message.startsWith('%')) return 'CONTROLLER_POSITION';
  if (message.startsWith('$ZC')) return 'CLIENT_ID';
  if (message.startsWith('$CR')) return 'CLIENT_RESPONSE';
  if (message.startsWith('$ZR')) return 'SERVER_RESPONSE';
  if (message.startsWith('#AA')) return 'AUTH_ADD';
  if (message.startsWith('#DA')) return 'AUTH_DELETE';

  return 'UNKNOWN';
}

/**
 * Parse position update message (@S: or @N:)
 * Format: @S:CALLSIGN:SQUAWK:RATING:LAT:LON:ALT:GS:PBH:FLAGS
 */
function parsePosition(message) {
  const fields = message.split(':');

  if (fields.length < 10) return null;

  return {
    callsign: fields[1],
    squawk: fields[2],
    rating: parseInt(fields[3]) || 0,
    latitude: parseFloat(fields[4]) || 0,
    longitude: parseFloat(fields[5]) || 0,
    altitude: parseInt(fields[6]) || 0,
    groundSpeed: parseInt(fields[7]) || 0,
    pbh: fields[8],
    flags: fields[9]
  };
}

/**
 * Parse flight plan message ($FP)
 * Format: $FPCALLSIGN:...flight plan data...
 */
function parseFlightPlan(message) {
  const callsignEnd = message.indexOf(':', 3);
  if (callsignEnd === -1) return null;

  return {
    callsign: message.substring(3, callsignEnd),
    data: message.substring(callsignEnd + 1)
  };
}

/**
 * Parse client query message ($CQ)
 * Format: $CQCALLSIGN:@SERVER:TYPE:DATA
 */
function parseClientQuery(message) {
  const fields = message.split(':');

  if (fields.length < 4) return null;

  const result = {
    callsign: fields[0].substring(3),
    server: fields[1],
    queryType: fields[2],
    data: fields.slice(3).join(':')
  };

  // Try to parse JSON data
  try {
    result.json = JSON.parse(result.data);
  } catch (e) {
    // Not JSON, keep as string
  }

  return result;
}

/**
 * Parse text message (#TM)
 * Format: #TMFROM:TO:MESSAGE
 */
function parseTextMessage(message) {
  const fields = message.split(':');

  if (fields.length < 3) return null;

  return {
    from: fields[0].substring(3),
    to: fields[1],
    message: fields.slice(2).join(':')
  };
}

/**
 * Parse controller position (%)
 * Format: %CALLSIGN:FREQ:FACILITY:RANGE:RATING:LAT:LON:ALT
 */
function parseControllerPosition(message) {
  const fields = message.split(':');

  if (fields.length < 8) return null;

  return {
    callsign: fields[0].substring(1),
    frequency: fields[1],
    facility: parseInt(fields[2]) || 0,
    visualRange: parseInt(fields[3]) || 0,
    rating: parseInt(fields[4]) || 0,
    latitude: parseFloat(fields[5]) || 0,
    longitude: parseFloat(fields[6]) || 0,
    altitudeRange: parseInt(fields[7]) || 0
  };
}

/**
 * Parse auth pilot message (#AP)
 * Format: #APCALLSIGN:SERVER:CID::VR:RATING:PROTOCOL:NAME
 */
function parseAuthPilot(message) {
  const fields = message.split(':');

  if (fields.length < 7) return null;

  return {
    callsign: fields[0].substring(3),
    server: fields[1],
    cid: fields[2],
    visualRange: fields[4],
    rating: parseInt(fields[5]) || 0,
    protocol: parseInt(fields[6]) || 0,
    realName: fields.slice(7).join(':')
  };
}

/**
 * Parse any FSD message
 * @param {string} message - Raw FSD message
 * @returns {Object} Parsed message with type and data
 */
function parseMessage(message) {
  const type = identifyMessageType(message);

  let parsed = null;

  switch (type) {
    case 'POSITION_SLOW':
    case 'POSITION_FAST':
      parsed = parsePosition(message);
      break;
    case 'FLIGHT_PLAN':
      parsed = parseFlightPlan(message);
      break;
    case 'CLIENT_QUERY':
      parsed = parseClientQuery(message);
      break;
    case 'TEXT_MESSAGE':
      parsed = parseTextMessage(message);
      break;
    case 'CONTROLLER_POSITION':
      parsed = parseControllerPosition(message);
      break;
    case 'AUTH_PILOT':
      parsed = parseAuthPilot(message);
      break;
  }

  return {
    type,
    raw: message,
    parsed
  };
}

/**
 * Create an FSD message parser instance
 * @returns {Object} Parser with event emitter
 */
function createFsdParser() {
  const emitter = new EventEmitter();
  let buffer = '';
  let messageCount = 0;
  const stats = {
    total: 0,
    byType: {}
  };

  /**
   * Process raw data (may contain multiple messages)
   * @param {string} data - Raw data from network capture
   */
  function processData(data) {
    buffer += data;

    // Split by line endings (FSD uses \r\n)
    const lines = buffer.split(/\r?\n/);

    // Keep incomplete line in buffer
    buffer = lines.pop() || '';

    // Process complete lines
    lines.forEach(line => {
      if (line.trim()) {
        processMessage(line.trim());
      }
    });
  }

  /**
   * Process a single FSD message
   * @param {string} message - Single FSD message
   */
  function processMessage(message) {
    messageCount++;

    const parsed = parseMessage(message);

    // Update stats
    stats.total++;
    stats.byType[parsed.type] = (stats.byType[parsed.type] || 0) + 1;

    // Emit general message event
    emitter.emit('message', parsed);

    // Emit type-specific event
    const eventName = parsed.type.toLowerCase();
    emitter.emit(eventName, parsed.parsed);

    // Emit special events for important messages
    if (parsed.type === 'TEXT_MESSAGE') {
      emitter.emit('clearance', parsed.parsed);
    }
  }

  /**
   * Get parser statistics
   */
  function getStats() {
    return {
      messageCount,
      ...stats
    };
  }

  /**
   * Reset parser state
   */
  function reset() {
    buffer = '';
    messageCount = 0;
    stats.total = 0;
    stats.byType = {};
  }

  // Public API
  return {
    processData,
    getStats,
    reset,
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter)
  };
}

module.exports = {
  createFsdParser,
  identifyMessageType,
  parseMessage
};

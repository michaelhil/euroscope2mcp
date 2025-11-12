/**
 * parsers/fsd-parser.js
 * FSD (Flight Simulator Display) protocol parser plugin
 */

const {
  createBaseParser,
  startsWithAny,
  splitMessage,
  parseIntField,
  parseFloatField
} = require('../base-parser');

/**
 * Create FSD parser instance
 */
function createFsdParser(config = {}) {
  const base = createBaseParser({
    name: 'fsd',
    version: '1.0.0',
    description: 'VATSIM FSD Protocol Parser',
    ...config
  });

  return {
    ...base,

    canHandle(message) {
      if (!message || message.length === 0) return false;

      const prefixes = ['@S:', '@N:', '$FP', '$CQ', '#TM', '#PC', '#AP', '#ST', '%', '$ZC', '$CR', '$ZR', '#AA', '#DA'];
      return startsWithAny(message, prefixes);
    },

    parse(message) {
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
        parsed,
        timestamp: Date.now()
      };
    }
  };
}

/**
 * Identify FSD message type
 */
function identifyMessageType(message) {
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
 * Parse position update (@S: or @N:)
 * Format: @S:CALLSIGN:SQUAWK:RATING:LAT:LON:ALT:GS:PBH:FLAGS
 */
function parsePosition(message) {
  const fields = splitMessage(message);
  if (fields.length < 10) return null;

  return {
    callsign: fields[1],
    squawk: fields[2],
    rating: parseIntField(fields[3]),
    latitude: parseFloatField(fields[4]),
    longitude: parseFloatField(fields[5]),
    altitude: parseIntField(fields[6]),
    groundSpeed: parseIntField(fields[7]),
    pbh: fields[8],
    flags: fields[9]
  };
}

/**
 * Parse flight plan ($FP)
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
 * Parse client query ($CQ)
 * Format: $CQCALLSIGN:@SERVER:TYPE:DATA
 */
function parseClientQuery(message) {
  const fields = splitMessage(message);
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
  const fields = splitMessage(message);
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
  const fields = splitMessage(message);
  if (fields.length < 8) return null;

  return {
    callsign: fields[0].substring(1),
    frequency: fields[1],
    facility: parseIntField(fields[2]),
    visualRange: parseIntField(fields[3]),
    rating: parseIntField(fields[4]),
    latitude: parseFloatField(fields[5]),
    longitude: parseFloatField(fields[6]),
    altitudeRange: parseIntField(fields[7])
  };
}

/**
 * Parse auth pilot (#AP)
 * Format: #APCALLSIGN:SERVER:CID::VR:RATING:PROTOCOL:NAME
 */
function parseAuthPilot(message) {
  const fields = splitMessage(message);
  if (fields.length < 7) return null;

  return {
    callsign: fields[0].substring(3),
    server: fields[1],
    cid: fields[2],
    visualRange: fields[4],
    rating: parseIntField(fields[5]),
    protocol: parseIntField(fields[6]),
    realName: fields.slice(7).join(':')
  };
}

module.exports = createFsdParser;

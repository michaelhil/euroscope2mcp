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
      // Split batched messages by \r\n
      const subMessages = message.split('\\r\\n').filter(m => m.trim().length > 0);

      // If only one message, parse normally
      if (subMessages.length === 1) {
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
          case 'POSITION_TRANSMISSION':
            parsed = parseStationPosition(message);
            break;
        }

        return {
          type,
          raw: message,
          parsed,
          humanReadable: generateHumanReadable(type, parsed),
          timestamp: Date.now()
        };
      }

      // Multiple messages - parse each one
      const parsedSubMessages = subMessages.map(subMsg => {
        const type = identifyMessageType(subMsg);
        let parsed = null;

        switch (type) {
          case 'POSITION_SLOW':
          case 'POSITION_FAST':
            parsed = parsePosition(subMsg);
            break;
          case 'FLIGHT_PLAN':
            parsed = parseFlightPlan(subMsg);
            break;
          case 'CLIENT_QUERY':
            parsed = parseClientQuery(subMsg);
            break;
          case 'TEXT_MESSAGE':
            parsed = parseTextMessage(subMsg);
            break;
          case 'CONTROLLER_POSITION':
            parsed = parseControllerPosition(subMsg);
            break;
          case 'AUTH_PILOT':
            parsed = parseAuthPilot(subMsg);
            break;
          case 'POSITION_TRANSMISSION':
            parsed = parseStationPosition(subMsg);
            break;
        }

        return {
          type,
          raw: subMsg,
          parsed,
          humanReadable: generateHumanReadable(type, parsed)
        };
      });

      // Return with sub-messages array
      return {
        type: 'BATCHED',
        raw: message,
        parsed: { subMessages: parsedSubMessages, count: parsedSubMessages.length },
        humanReadable: parsedSubMessages.length + ' batched messages',
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

/**
 * Parse station position (#ST)
 * Format: #STCALLSIGN:LAT:LON:ALT_AGL:GS:FLAGS:VS
 */
function parseStationPosition(message) {
  const fields = splitMessage(message);
  if (fields.length < 7) return null;

  return {
    callsign: fields[0].substring(3),
    latitude: parseFloatField(fields[1]),
    longitude: parseFloatField(fields[2]),
    altitudeAGL: parseFloatField(fields[3]),
    groundSpeed: parseFloatField(fields[4]),
    flags: fields[5],
    verticalSpeed: parseFloatField(fields[6])
  };
}

/**
 * Generate human-readable description
 */
function generateHumanReadable(type, parsed) {
  if (!parsed) return 'Unable to parse message';

  switch (type) {
    case 'POSITION_FAST':
    case 'POSITION_SLOW':
      return parsed.callsign + ' at ' + Math.round(parsed.altitude) + 'ft, ' +
             Math.round(parsed.groundSpeed) + 'kts, squawk ' + parsed.squawk;

    case 'FLIGHT_PLAN':
      const fpData = parsed.data || '';
      const fpParts = fpData.split(':');
      if (fpParts.length >= 9) {
        const dep = fpParts[4] || '?';
        const dest = fpParts[8] || '?';
        const alt = fpParts[7] || '?';
        return parsed.callsign + ' flight plan: ' + dep + ' to ' + dest + ' at FL' + Math.floor(alt/100);
      }
      return parsed.callsign + ' filed flight plan';

    case 'CLIENT_QUERY':
      return generateQueryReadable(parsed);

    case 'TEXT_MESSAGE':
      return parsed.from + ' to ' + parsed.to + ': "' + parsed.message + '"';

    case 'CONTROLLER_POSITION':
      const freq = parseFloat(parsed.frequency) / 1000 + 100;
      const facilityNames = ['OBS', 'FSS', 'DEL', 'GND', 'TWR', 'APP', 'CTR', 'DEP'];
      const facilityName = facilityNames[parsed.facility] || 'UNK';
      return parsed.callsign + ' (' + facilityName + ') online on ' + freq.toFixed(3) + ' MHz';

    case 'POSITION_TRANSMISSION':
      return parsed.callsign + ' station position at ' + Math.round(parsed.altitudeAGL) + 'm AGL, ' +
             Math.round(parsed.groundSpeed) + ' m/s';

    case 'AUTH_PILOT':
      return parsed.callsign + ' connected: ' + (parsed.realName || 'Unknown');

    default:
      return type.replace(/_/g, ' ').toLowerCase();
  }
}

/**
 * Generate human-readable for client queries
 */
function generateQueryReadable(parsed) {
  const cs = parsed.callsign || '?';
  const target = parsed.data.split(':')[0] || '';

  switch (parsed.queryType) {
    case 'ACC':
      if (parsed.json && parsed.json.config) {
        const config = parsed.json.config;
        const parts = [];
        if (config.on_ground !== undefined) parts.push(config.on_ground ? 'on ground' : 'airborne');
        if (config.flaps_pct !== undefined) parts.push('flaps ' + config.flaps_pct + '%');
        if (config.spoilers_out !== undefined) parts.push(config.spoilers_out ? 'spoilers out' : 'spoilers in');
        if (config.lights) {
          if (config.lights.landing_on !== undefined) parts.push('landing lights ' + (config.lights.landing_on ? 'on' : 'off'));
          if (config.lights.taxi_on !== undefined) parts.push('taxi lights ' + (config.lights.taxi_on ? 'on' : 'off'));
        }
        if (config.engines) {
          Object.keys(config.engines).forEach(eng => {
            const e = config.engines[eng];
            if (e.on !== undefined) parts.push('engine ' + eng + ' ' + (e.on ? 'on' : 'off'));
            if (e.is_reversing !== undefined && e.is_reversing) parts.push('engine ' + eng + ' reversing');
          });
        }
        return cs + ' config: ' + (parts.length > 0 ? parts.join(', ') : 'update');
      }
      return cs + ' config update';

    case 'WH':
      return cs + ' queries: who has ' + target + '?';

    case 'SC':
      const note = parsed.data.split(':').slice(1).join(':');
      return cs + ' sets scratch pad for ' + target + ': "' + (note || '(clear)') + '"';

    case 'TA':
      const taAlt = parsed.data.split(':')[1];
      return cs + ' assigns temp altitude to ' + target + ': ' + (taAlt === '0' ? 'cancel' : taAlt + ' ft');

    case 'FA':
      const faAlt = parsed.data.split(':')[1];
      return cs + ' assigns final altitude to ' + target + ': ' + (faAlt === '0' ? 'cancel' : faAlt + ' ft');

    case 'IT':
      return cs + ' initiates radar contact with ' + target;

    case 'FP':
      return cs + ' requests flight plan for ' + target;

    case 'BC':
      const squawk = parsed.data.split(':')[1];
      return cs + ' assigns squawk ' + squawk + ' to ' + target;

    case 'HT':
      const toController = parsed.data.split(':')[1];
      return cs + ' hands off ' + target + ' to ' + toController;

    case 'DR':
      return cs + ' clears ' + target + ' direct routing';

    case 'VT':
      const vtype = parsed.data.split(':')[1];
      const vtypeMap = { t: 'text-only', v: 'voice', r: 'receive' };
      return cs + ' sets ' + target + ' voice type to ' + (vtypeMap[vtype] || vtype);

    case 'NEWATIS':
      const atisParts = parsed.data.split(':');
      return cs + ' broadcasts new ATIS ' + atisParts[0] + ': ' + atisParts.slice(1).join(' ');

    case 'ATC':
      return cs + ' queries ATC info for ' + target;

    default:
      return cs + ' query ' + parsed.queryType + ': ' + target;
  }
}

module.exports = createFsdParser;

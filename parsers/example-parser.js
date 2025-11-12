/**
 * example-parser.js
 * Example custom parser demonstrating all features
 *
 * This parser handles hypothetical clearance messages with enhanced parsing
 * Format: #CLR:FROM:TO:TYPE:DETAILS
 */

const {
  createBaseParser,
  splitMessage,
  parseIntField,
  parseFloatField
} = require('../src/parser/base-parser');

/**
 * Create example clearance parser
 */
function createExampleParser(config = {}) {
  const base = createBaseParser({
    name: 'example',
    version: '1.0.0',
    description: 'Example clearance parser with lookup tables',
    ...config
  });

  // Clearance type lookup table
  const clearanceTypes = {
    'TKOF': 'Takeoff Clearance',
    'LAND': 'Landing Clearance',
    'TAXI': 'Taxi Clearance',
    'CLMB': 'Climb Clearance',
    'DESC': 'Descent Clearance',
    'HOLD': 'Hold Instructions',
    'APPR': 'Approach Clearance',
    'PUSH': 'Pushback Clearance'
  };

  // Runway patterns
  const runwayPattern = /RWY\s*(\d{2}[LCR]?)/i;

  // Altitude patterns
  const altitudePattern = /(\d{3,5})\s*(FT|FL)?/i;

  /**
   * Extract runway from message
   */
  function extractRunway(text) {
    const match = text.match(runwayPattern);
    return match ? match[1] : null;
  }

  /**
   * Extract altitude from message
   */
  function extractAltitude(text) {
    const match = text.match(altitudePattern);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2] || 'FT';

    return {
      value,
      unit,
      feet: unit === 'FL' ? value * 100 : value
    };
  }

  /**
   * Parse clearance details
   */
  function parseDetails(type, details) {
    const parsed = {
      raw: details,
      runway: extractRunway(details),
      altitude: extractAltitude(details)
    };

    // Type-specific parsing
    switch (type) {
      case 'TKOF':
        parsed.windInfo = extractWind(details);
        break;
      case 'TAXI':
        parsed.route = extractTaxiRoute(details);
        break;
      case 'HOLD':
        parsed.fix = extractHoldFix(details);
        break;
    }

    return parsed;
  }

  /**
   * Extract wind information (simplified)
   */
  function extractWind(text) {
    const windPattern = /(\d{3})\/(\d{2})/;
    const match = text.match(windPattern);

    if (match) {
      return {
        direction: parseInt(match[1]),
        speed: parseInt(match[2])
      };
    }

    return null;
  }

  /**
   * Extract taxi route (simplified)
   */
  function extractTaxiRoute(text) {
    const routePattern = /VIA\s+([A-Z0-9\s,]+)/i;
    const match = text.match(routePattern);

    if (match) {
      return match[1].split(/[,\s]+/).filter(Boolean);
    }

    return [];
  }

  /**
   * Extract holding fix (simplified)
   */
  function extractHoldFix(text) {
    const fixPattern = /HOLD\s+AT\s+([A-Z0-9]+)/i;
    const match = text.match(fixPattern);
    return match ? match[1] : null;
  }

  return {
    ...base,

    /**
     * Initialize parser
     */
    init() {
      console.log(`[${this.name}] Parser initialized with ${Object.keys(clearanceTypes).length} clearance types`);
    },

    /**
     * Check if parser can handle this message
     */
    canHandle(message) {
      // Handle messages starting with #CLR
      return message.startsWith('#CLR:');
    },

    /**
     * Parse the message
     */
    parse(message) {
      const fields = splitMessage(message);

      // Validate minimum field count
      if (fields.length < 5) {
        console.warn(`[${this.name}] Invalid message format: ${message}`);
        return null;
      }

      const from = fields[0].substring(5); // Remove '#CLR:' prefix
      const to = fields[1];
      const typeCode = fields[2];
      const details = fields.slice(3).join(':');

      // Look up clearance type
      const clearanceType = clearanceTypes[typeCode] || typeCode;

      // Parse details
      const parsedDetails = parseDetails(typeCode, details);

      return {
        type: 'CLEARANCE',
        raw: message,
        parsed: {
          from,
          to,
          clearanceCode: typeCode,
          clearanceType,
          details: parsedDetails,
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
      };
    },

    /**
     * Validate parsed message
     */
    validate(parsed) {
      // Ensure required fields are present
      return parsed &&
             parsed.from &&
             parsed.to &&
             parsed.clearanceType;
    }
  };
}

// Export the factory function
module.exports = createExampleParser;

// For testing: run this file directly
if (require.main === module) {
  const parser = createExampleParser();
  parser.init();

  console.log('\n=== Testing Example Parser ===\n');

  const testMessages = [
    '#CLR:JFK_TWR:UAL123:TKOF:CLEARED TAKEOFF RWY 31L WIND 320/15',
    '#CLR:JFK_GND:AAL456:TAXI:TAXI TO RWY 22R VIA A, B, C',
    '#CLR:NYC_APP:DAL789:CLMB:CLIMB AND MAINTAIN FL250',
    '#CLR:NYC_CTR:SWA321:HOLD:HOLD AT DREXL AS PUBLISHED',
    '#CLR:INVALID:MESSAGE',
  ];

  testMessages.forEach(msg => {
    console.log(`\nInput: ${msg}`);

    if (parser.canHandle(msg)) {
      const result = parser.parse(msg);

      if (result && parser.validate(result.parsed)) {
        console.log('✓ Valid');
        console.log('Parsed:', JSON.stringify(result.parsed, null, 2));
      } else {
        console.log('✗ Invalid parse result');
      }
    } else {
      console.log('✗ Parser cannot handle this message');
    }
  });

  console.log('\n=== Test Complete ===\n');
}

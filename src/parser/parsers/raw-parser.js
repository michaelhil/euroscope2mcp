/**
 * parsers/raw-parser.js
 * Raw pass-through parser (no transformation)
 */

const { createBaseParser } = require('../base-parser');

/**
 * Create raw parser instance
 */
function createRawParser(config = {}) {
  const base = createBaseParser({
    name: 'raw',
    version: '1.0.0',
    description: 'Raw pass-through parser',
    ...config
  });

  return {
    ...base,

    canHandle(message) {
      // Raw parser can handle any message
      return true;
    },

    parse(message) {
      return {
        type: 'RAW',
        raw: message,
        parsed: {
          message,
          length: message.length
        },
        timestamp: Date.now()
      };
    }
  };
}

module.exports = createRawParser;

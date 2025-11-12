/**
 * base-parser.js
 * Base interface for all parsers (functional style)
 */

/**
 * Create a base parser with common functionality
 * @param {Object} config - Parser configuration
 * @returns {Object} Base parser functions
 */
function createBaseParser(config = {}) {
  return {
    name: config.name || 'unknown',
    config,

    /**
     * Initialize parser (override in implementations)
     */
    init() {
      // Override this
    },

    /**
     * Check if this parser should handle the message
     * @param {string} message - Raw message
     * @returns {boolean} True if parser should handle this message
     */
    canHandle(message) {
      throw new Error('canHandle() must be implemented');
    },

    /**
     * Parse the message
     * @param {string} message - Raw message
     * @returns {Object|null} Parsed message or null if invalid
     */
    parse(message) {
      throw new Error('parse() must be implemented');
    },

    /**
     * Validate parsed message (optional)
     * @param {Object} parsed - Parsed message
     * @returns {boolean} True if valid
     */
    validate(parsed) {
      return parsed !== null && parsed !== undefined;
    },

    /**
     * Get parser metadata
     */
    getMetadata() {
      return {
        name: this.name,
        version: this.config.version || '1.0.0',
        description: this.config.description || 'No description'
      };
    }
  };
}

/**
 * Helper: Check if message starts with prefix
 */
function startsWithAny(message, prefixes) {
  return prefixes.some(prefix => message.startsWith(prefix));
}

/**
 * Helper: Split message by delimiter
 */
function splitMessage(message, delimiter = ':') {
  return message.split(delimiter);
}

/**
 * Helper: Parse integer field
 */
function parseIntField(value, defaultValue = 0) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper: Parse float field
 */
function parseFloatField(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

module.exports = {
  createBaseParser,
  startsWithAny,
  splitMessage,
  parseIntField,
  parseFloatField
};

/**
 * index.js
 * Main entry point for euroscope2mcp
 */

const { createTsharkCapture } = require('./capture/tshark-capture');
const { createFsdParser } = require('./parser/fsd-parser');

/**
 * Create a complete EuroScope to MCP pipeline
 * @param {Object} options - Configuration options
 * @param {string} options.interface - Network interface (default: 'Ethernet')
 * @param {number} options.port - VATSIM port (default: 6809)
 * @param {string} options.tsharkPath - Path to tshark executable
 * @returns {Object} Pipeline controller
 */
function createEuroscopePipeline(options = {}) {
  const capture = createTsharkCapture(options);
  const parser = createFsdParser();

  let isRunning = false;

  // Connect capture output to parser input
  capture.on('data', (data) => {
    parser.processData(data);
  });

  // Forward parser events
  const forwardEvents = [
    'message',
    'position_slow',
    'position_fast',
    'flight_plan',
    'text_message',
    'clearance',
    'client_query',
    'controller_position',
    'auth_pilot'
  ];

  const eventHandlers = {};
  forwardEvents.forEach(event => {
    eventHandlers[event] = [];
  });

  /**
   * Start the pipeline
   */
  function start() {
    if (isRunning) {
      throw new Error('Pipeline already running');
    }

    capture.start();
    isRunning = true;
  }

  /**
   * Stop the pipeline
   */
  function stop() {
    if (!isRunning) {
      return;
    }

    capture.stop();
    isRunning = false;
  }

  /**
   * Get pipeline status and statistics
   */
  function getStatus() {
    return {
      isRunning,
      capture: capture.getStatus(),
      parser: parser.getStats()
    };
  }

  /**
   * Register event handler
   */
  function on(event, handler) {
    parser.on(event, handler);
  }

  /**
   * Register one-time event handler
   */
  function once(event, handler) {
    parser.once(event, handler);
  }

  /**
   * Remove event handler
   */
  function off(event, handler) {
    parser.off(event, handler);
  }

  // Forward capture events
  capture.on('started', (info) => parser.emit && parser.emit('started', info));
  capture.on('stopped', () => parser.emit && parser.emit('stopped'));
  capture.on('error', (err) => parser.emit && parser.emit('error', err));

  // Public API
  return {
    start,
    stop,
    getStatus,
    on,
    once,
    off
  };
}

module.exports = {
  createEuroscopePipeline,
  createTsharkCapture,
  createFsdParser
};

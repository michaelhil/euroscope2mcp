/**
 * pipeline-manager.js
 * Main pipeline orchestrator - connects capture, parser, and outputs
 */

const { createCaptureManager } = require('../capture/capture-manager');
const { createParserRegistry } = require('../parser/parser-registry');
const { createEventPipeline } = require('./event-pipeline');
const { join } = require('path');

/**
 * Create pipeline manager
 */
function createPipelineManager(config) {
  const captureManager = createCaptureManager({
    interface: config.capture.interface,
    tsharkPath: config.capture.tsharkPath
  });

  const parserRegistry = createParserRegistry();
  const eventPipeline = createEventPipeline();

  let isRunning = false;

  /**
   * Initialize the pipeline
   */
  function init() {
    // Register built-in parsers
    const fsdParser = require('../parser/parsers/fsd-parser');
    const rawParser = require('../parser/parsers/raw-parser');

    parserRegistry.register('fsd', fsdParser);
    parserRegistry.register('raw', rawParser);

    // Load custom parsers from ./parsers directory
    const customParsersPath = join(process.cwd(), 'parsers');
    try {
      parserRegistry.loadFromDirectory(customParsersPath);
    } catch (err) {
      console.warn('Could not load custom parsers:', err.message);
    }

    // Configure ports from config
    config.capture.ports.forEach(portConfig => {
      try {
        captureManager.addPort(portConfig);
      } catch (err) {
        console.error(`Error adding port ${portConfig.port}:`, err.message);
      }
    });

    // Connect capture to parser
    captureManager.on('data', handleCaptureData);
    captureManager.on('port-error', (info) => {
      console.error(`Port ${info.port} error:`, info.error);
    });
  }

  /**
   * Handle incoming capture data
   */
  async function handleCaptureData(captureData) {
    const { port, parser: parserName, data } = captureData;

    try {
      // Get or create parser instance
      const parser = parserRegistry.create(parserName, {});

      // Check if parser can handle this message
      if (!parser.canHandle(data)) {
        return;
      }

      // Parse the message
      const parsedMessage = parser.parse(data);

      if (!parsedMessage) {
        return;
      }

      // Add port metadata
      const enrichedMessage = {
        ...parsedMessage,
        port,
        parserName
      };

      // Send to event pipeline
      await eventPipeline.processMessage(enrichedMessage);
    } catch (err) {
      console.error(`Error processing message from port ${port}:`, err.message);
    }
  }

  /**
   * Register an output handler
   */
  function registerOutput(name, handler) {
    eventPipeline.registerOutput(name, handler);
  }

  /**
   * Unregister an output handler
   */
  function unregisterOutput(name) {
    eventPipeline.unregisterOutput(name);
  }

  /**
   * Start the pipeline
   */
  function start() {
    if (isRunning) {
      throw new Error('Pipeline already running');
    }

    captureManager.startAll();
    isRunning = true;
  }

  /**
   * Stop the pipeline
   */
  function stop() {
    if (!isRunning) {
      return;
    }

    captureManager.stopAll();
    isRunning = false;
  }

  /**
   * Add a port dynamically
   */
  function addPort(portConfig) {
    captureManager.addPort(portConfig);

    // Start immediately if pipeline is running
    if (isRunning && portConfig.enabled !== false) {
      captureManager.startPort(portConfig.port);
    }
  }

  /**
   * Remove a port
   */
  function removePort(port) {
    return captureManager.removePort(port);
  }

  /**
   * Get comprehensive status
   */
  function getStatus() {
    return {
      isRunning,
      capture: captureManager.getStatus(),
      pipeline: eventPipeline.getStats(),
      parsers: parserRegistry.list()
    };
  }

  /**
   * Subscribe to events
   */
  function on(event, handler) {
    eventPipeline.on(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  function off(event, handler) {
    eventPipeline.off(event, handler);
  }

  return {
    init,
    start,
    stop,
    addPort,
    removePort,
    registerOutput,
    unregisterOutput,
    getStatus,
    on,
    off,
    captureManager,
    parserRegistry,
    eventPipeline
  };
}

module.exports = { createPipelineManager };

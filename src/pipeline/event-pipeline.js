/**
 * event-pipeline.js
 * Central event bus for distributing messages to outputs
 */

const EventEmitter = require('events');

/**
 * Create event pipeline
 */
function createEventPipeline() {
  const emitter = new EventEmitter();
  const outputs = new Map(); // name -> output handler
  const stats = {
    totalMessages: 0,
    messagesByType: {},
    messagesByPort: {},
    startTime: Date.now()
  };

  /**
   * Register an output handler
   */
  function registerOutput(name, handler) {
    if (outputs.has(name)) {
      console.warn(`Output '${name}' already registered, overwriting`);
    }

    outputs.set(name, {
      handler,
      enabled: true,
      messageCount: 0,
      errorCount: 0
    });
  }

  /**
   * Unregister an output handler
   */
  function unregisterOutput(name) {
    outputs.delete(name);
  }

  /**
   * Enable an output
   */
  function enableOutput(name) {
    const output = outputs.get(name);
    if (output) {
      output.enabled = true;
    }
  }

  /**
   * Disable an output
   */
  function disableOutput(name) {
    const output = outputs.get(name);
    if (output) {
      output.enabled = false;
    }
  }

  /**
   * Process incoming message
   */
  async function processMessage(message) {
    stats.totalMessages++;

    // Update stats
    const messageType = message.type || 'UNKNOWN';
    stats.messagesByType[messageType] = (stats.messagesByType[messageType] || 0) + 1;

    if (message.port) {
      stats.messagesByPort[message.port] = (stats.messagesByPort[message.port] || 0) + 1;
    }

    // Emit general event
    emitter.emit('message', message);

    // Emit type-specific event
    const eventName = messageType.toLowerCase();
    emitter.emit(eventName, message);

    // Send to all enabled outputs
    const outputPromises = [];

    for (const [name, output] of outputs.entries()) {
      if (!output.enabled) continue;

      try {
        const promise = Promise.resolve(output.handler(message))
          .then(() => {
            output.messageCount++;
          })
          .catch((err) => {
            output.errorCount++;
            emitter.emit('output-error', {
              output: name,
              error: err,
              message
            });
          });

        outputPromises.push(promise);
      } catch (err) {
        output.errorCount++;
        emitter.emit('output-error', {
          output: name,
          error: err,
          message
        });
      }
    }

    // Wait for all outputs (but don't block on errors)
    await Promise.allSettled(outputPromises);
  }

  /**
   * Get pipeline statistics
   */
  function getStats() {
    const outputStats = {};
    for (const [name, output] of outputs.entries()) {
      outputStats[name] = {
        enabled: output.enabled,
        messageCount: output.messageCount,
        errorCount: output.errorCount
      };
    }

    const uptime = Date.now() - stats.startTime;
    const messagesPerSecond = stats.totalMessages / (uptime / 1000);

    return {
      totalMessages: stats.totalMessages,
      messagesByType: { ...stats.messagesByType },
      messagesByPort: { ...stats.messagesByPort },
      outputs: outputStats,
      uptime,
      messagesPerSecond: messagesPerSecond.toFixed(2)
    };
  }

  /**
   * Reset statistics
   */
  function resetStats() {
    stats.totalMessages = 0;
    stats.messagesByType = {};
    stats.messagesByPort = {};
    stats.startTime = Date.now();

    for (const output of outputs.values()) {
      output.messageCount = 0;
      output.errorCount = 0;
    }
  }

  /**
   * List all registered outputs
   */
  function listOutputs() {
    return Array.from(outputs.keys());
  }

  /**
   * Get output status
   */
  function getOutputStatus(name) {
    const output = outputs.get(name);
    if (!output) return null;

    return {
      name,
      enabled: output.enabled,
      messageCount: output.messageCount,
      errorCount: output.errorCount
    };
  }

  return {
    registerOutput,
    unregisterOutput,
    enableOutput,
    disableOutput,
    processMessage,
    getStats,
    resetStats,
    listOutputs,
    getOutputStatus,
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter)
  };
}

module.exports = { createEventPipeline };

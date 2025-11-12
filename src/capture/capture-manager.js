/**
 * capture-manager.js
 * Manages multiple tshark capture instances (multi-port support)
 */

const EventEmitter = require('events');
const { createTsharkCapture } = require('./tshark-capture');

/**
 * Create capture manager for multiple ports
 */
function createCaptureManager(options = {}) {
  const emitter = new EventEmitter();
  const captures = new Map(); // port -> capture instance
  const stats = new Map(); // port -> statistics

  const config = {
    interface: options.interface || 'Ethernet',
    tsharkPath: options.tsharkPath || 'C:\\Program Files\\Wireshark\\tshark.exe'
  };

  /**
   * Add a port to monitor
   */
  function addPort(portConfig) {
    const { port, parser, label, enabled = true } = portConfig;

    if (captures.has(port)) {
      throw new Error(`Port ${port} already being monitored`);
    }

    // Create capture instance
    const capture = createTsharkCapture({
      ...config,
      port,
      interface: portConfig.interface || config.interface
    });

    // Initialize stats
    stats.set(port, {
      port,
      label: label || `Port ${port}`,
      parser,
      messageCount: 0,
      bytesReceived: 0,
      startTime: null,
      lastMessageTime: null
    });

    // Forward events with port metadata
    capture.on('data', (data) => {
      const portStats = stats.get(port);
      portStats.messageCount++;
      portStats.bytesReceived += data.length;
      portStats.lastMessageTime = Date.now();

      emitter.emit('data', {
        port,
        parser,
        label,
        data
      });
    });

    capture.on('started', (info) => {
      const portStats = stats.get(port);
      portStats.startTime = Date.now();
      emitter.emit('port-started', { port, ...info });
    });

    capture.on('stopped', () => {
      emitter.emit('port-stopped', { port });
    });

    capture.on('error', (err) => {
      emitter.emit('port-error', { port, error: err });
    });

    capture.on('warning', (msg) => {
      emitter.emit('port-warning', { port, message: msg });
    });

    captures.set(port, { capture, config: portConfig, enabled });

    return true;
  }

  /**
   * Remove a port from monitoring
   */
  function removePort(port) {
    const entry = captures.get(port);
    if (!entry) {
      return false;
    }

    // Stop capture if running
    entry.capture.stop();

    // Clean up
    captures.delete(port);
    stats.delete(port);

    emitter.emit('port-removed', { port });
    return true;
  }

  /**
   * Start capturing on a specific port
   */
  function startPort(port) {
    const entry = captures.get(port);
    if (!entry) {
      throw new Error(`Port ${port} not configured`);
    }

    if (!entry.enabled) {
      throw new Error(`Port ${port} is disabled`);
    }

    entry.capture.start();
  }

  /**
   * Stop capturing on a specific port
   */
  function stopPort(port) {
    const entry = captures.get(port);
    if (!entry) {
      throw new Error(`Port ${port} not configured`);
    }

    entry.capture.stop();
  }

  /**
   * Start all enabled ports
   */
  function startAll() {
    for (const [port, entry] of captures.entries()) {
      if (entry.enabled) {
        try {
          entry.capture.start();
        } catch (err) {
          emitter.emit('port-error', { port, error: err });
        }
      }
    }
  }

  /**
   * Stop all ports
   */
  function stopAll() {
    for (const [port, entry] of captures.entries()) {
      try {
        entry.capture.stop();
      } catch (err) {
        // Ignore errors when stopping
      }
    }
  }

  /**
   * Enable a port
   */
  function enablePort(port) {
    const entry = captures.get(port);
    if (!entry) {
      throw new Error(`Port ${port} not configured`);
    }
    entry.enabled = true;
  }

  /**
   * Disable a port
   */
  function disablePort(port) {
    const entry = captures.get(port);
    if (!entry) {
      throw new Error(`Port ${port} not configured`);
    }

    // Stop if running
    try {
      entry.capture.stop();
    } catch (err) {
      // Ignore
    }

    entry.enabled = false;
  }

  /**
   * Get status of all ports
   */
  function getStatus() {
    const portStatus = [];

    for (const [port, entry] of captures.entries()) {
      const captureStatus = entry.capture.getStatus();
      const portStats = stats.get(port);

      portStatus.push({
        port,
        label: entry.config.label,
        parser: entry.config.parser,
        enabled: entry.enabled,
        isCapturing: captureStatus.isCapturing,
        stats: { ...portStats }
      });
    }

    return {
      totalPorts: captures.size,
      activePorts: portStatus.filter(p => p.isCapturing).length,
      ports: portStatus
    };
  }

  /**
   * Get statistics for a specific port
   */
  function getPortStats(port) {
    return stats.get(port) || null;
  }

  /**
   * List all configured ports
   */
  function listPorts() {
    return Array.from(captures.keys());
  }

  return {
    addPort,
    removePort,
    startPort,
    stopPort,
    startAll,
    stopAll,
    enablePort,
    disablePort,
    getStatus,
    getPortStats,
    listPorts,
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter)
  };
}

module.exports = { createCaptureManager };

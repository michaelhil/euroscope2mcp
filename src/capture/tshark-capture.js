/**
 * tshark-capture.js
 * Factory function for capturing network traffic using tshark
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * Create a tshark capture instance
 * @param {Object} options - Configuration options
 * @param {string} options.interface - Network interface to capture on
 * @param {number} options.port - TCP port to filter (default: 6809)
 * @param {string} options.tsharkPath - Path to tshark executable
 * @returns {Object} Capture controller with start/stop methods
 */
function createTsharkCapture(options = {}) {
  const config = {
    interface: options.interface || 'Ethernet',
    port: options.port || 6809,
    tsharkPath: options.tsharkPath || 'C:\\Program Files\\Wireshark\\tshark.exe'
  };

  const emitter = new EventEmitter();
  let tsharkProcess = null;
  let isCapturing = false;
  let buffer = '';

  /**
   * Start capturing packets
   */
  function start() {
    if (isCapturing) {
      throw new Error('Capture already running');
    }

    const args = [
      '-i', config.interface,
      '-f', `tcp port ${config.port}`,
      '-T', 'fields',
      '-e', 'data.text',
      '-l'  // Line buffered for real-time output
    ];

    tsharkProcess = spawn(config.tsharkPath, args);
    isCapturing = true;

    tsharkProcess.stdout.on('data', handleData);
    tsharkProcess.stderr.on('data', handleError);
    tsharkProcess.on('close', handleClose);
    tsharkProcess.on('error', handleProcessError);

    emitter.emit('started', { interface: config.interface, port: config.port });
  }

  /**
   * Stop capturing packets
   */
  function stop() {
    if (!isCapturing || !tsharkProcess) {
      return;
    }

    tsharkProcess.kill('SIGTERM');
    isCapturing = false;
    emitter.emit('stopped');
  }

  /**
   * Handle incoming data from tshark
   */
  function handleData(chunk) {
    const text = chunk.toString('utf-8');
    buffer += text;

    // Process complete lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    lines.forEach(line => {
      if (line.trim()) {
        // tshark with -T fields -e data.text outputs plain text, not hex
        emitter.emit('data', line.trim());
      }
    });
  }

  /**
   * Handle stderr output (usually status messages)
   */
  function handleError(chunk) {
    const message = chunk.toString('utf-8');
    // Only emit if it's not a normal status message
    if (!message.includes('Capturing on')) {
      emitter.emit('warning', message);
    }
  }

  /**
   * Handle process close
   */
  function handleClose(code) {
    isCapturing = false;
    emitter.emit('closed', { code });
  }

  /**
   * Handle process spawn errors
   */
  function handleProcessError(err) {
    isCapturing = false;
    emitter.emit('error', err);
  }

  /**
   * Decode hex string to text
   * @param {string} hexString - Hex encoded data from tshark
   * @returns {string} Decoded text
   */
  function decodeHexData(hexString) {
    if (!hexString || hexString.length === 0) {
      return null;
    }

    try {
      // Remove any whitespace
      const cleaned = hexString.replace(/\s/g, '');

      // Convert hex pairs to characters
      const bytes = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes.push(parseInt(cleaned.substr(i, 2), 16));
      }

      return Buffer.from(bytes).toString('utf-8');
    } catch (err) {
      return null;
    }
  }

  /**
   * Get current status
   */
  function getStatus() {
    return {
      isCapturing,
      config: { ...config }
    };
  }

  // Public API
  return {
    start,
    stop,
    getStatus,
    on: emitter.on.bind(emitter),
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter)
  };
}

module.exports = { createTsharkCapture };

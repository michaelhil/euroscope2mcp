/**
 * index.js
 * Main entry point for euroscope2mcp v2.0
 */

const { loadConfig, validateConfig } = require('./config/config-loader');
const { createPipelineManager } = require('./pipeline/pipeline-manager');
const { createWebServer } = require('./web/server');
const { createDbWriter } = require('./outputs/db-writer');
const { join } = require('path');

/**
 * Main application
 */
async function main() {
  console.log('euroscope2mcp v0.2.0');
  console.log('==================\n');

  // Load configuration
  console.log('Loading configuration...');
  const configPath = process.argv[2]; // Optional config path from CLI
  const config = loadConfig(configPath);

  // Validate configuration
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error('  - ' + err));
    process.exit(1);
  }

  console.log('Configuration loaded successfully\n');

  // Create pipeline manager
  console.log('Initializing pipeline...');
  const pipeline = createPipelineManager(config);
  pipeline.init();

  console.log('Registered parsers: ' + pipeline.parserRegistry.list().join(', '));
  console.log('Configured ports: ' + config.capture.ports.map(p => p.port).join(', ') + '\n');

  // Initialize database writer if enabled
  let dbWriter = null;
  if (config.outputs.database.enabled) {
    console.log('Initializing database writer...');
    try {
      dbWriter = createDbWriter(config);
      await dbWriter.init();

      // Register database output
      pipeline.registerOutput('database', async (message) => {
        await dbWriter.write(message);
      });

      console.log('Database writer initialized\n');
    } catch (err) {
      console.error('Failed to initialize database:', err.message);
      console.error('Continuing without database support\n');
    }
  }

  // Start web server if enabled
  let webServer = null;
  if (config.outputs.web.enabled) {
    console.log('Starting web server...');
    try {
      webServer = createWebServer(pipeline, config);
      webServer.start();
      console.log('Web UI available at http://' + config.outputs.web.host + ':' + config.outputs.web.port + '\n');
    } catch (err) {
      console.error('Failed to start web server:', err.message);
      process.exit(1);
    }
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');

    // Stop pipeline
    pipeline.stop();

    // Close database
    if (dbWriter) {
      await dbWriter.close();
    }

    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Log status every 30 seconds
  setInterval(() => {
    const status = pipeline.getStatus();
    console.log('Status: ' + (status.isRunning ? 'Running' : 'Stopped') + ' | ' +
                'Messages: ' + status.pipeline.totalMessages + ' | ' +
                'Rate: ' + status.pipeline.messagesPerSecond + '/sec');
  }, 30000);

  console.log('euroscope2mcp is ready');
  console.log('Use the web UI to start/stop capture or press Ctrl+C to exit\n');
}

// Export for programmatic use
module.exports = {
  loadConfig,
  createPipelineManager,
  createWebServer,
  createDbWriter
};

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

/**
 * multi-port-capture.js
 * Example: Capture from multiple ports simultaneously
 */

const { loadConfig, createPipelineManager } = require('../src/index');

async function main() {
  console.log('Multi-Port Capture Example\n');

  // Load config
  const config = loadConfig();

  // Add additional ports to monitor
  config.capture.ports.push(
    {
      port: 8080,
      parser: 'raw',
      enabled: true,
      label: 'Custom Port 8080'
    },
    {
      port: 9000,
      parser: 'raw',
      enabled: true,
      label: 'Custom Port 9000'
    }
  );

  // Create pipeline
  const pipeline = createPipelineManager(config);
  pipeline.init();

  // Listen for messages from all ports
  pipeline.on('message', (message) => {
    console.log(`[Port ${message.port}] ${message.type}: ${message.raw.substring(0, 80)}`);
  });

  // Listen for port-specific events
  pipeline.captureManager.on('port-started', (info) => {
    console.log(`✓ Started capturing on port ${info.port}`);
  });

  pipeline.captureManager.on('port-error', (info) => {
    console.error(`✗ Error on port ${info.port}:`, info.error.message);
  });

  // Start capture
  console.log('Starting capture on multiple ports...\n');
  pipeline.start();

  // Show status every 10 seconds
  setInterval(() => {
    const status = pipeline.getStatus();
    console.log('\n=== Status ===');
    console.log(`Total messages: ${status.pipeline.totalMessages}`);
    console.log(`Rate: ${status.pipeline.messagesPerSecond} msg/sec`);
    console.log(`Active ports: ${status.capture.activePorts}`);

    status.capture.ports.forEach(port => {
      console.log(`  Port ${port.port} (${port.label}): ${port.stats.messageCount} messages`);
    });
  }, 10000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nStopping...');
    pipeline.stop();
    process.exit(0);
  });
}

main().catch(console.error);

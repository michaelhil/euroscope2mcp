/**
 * custom-parser-demo.js
 * Example: Using custom parsers
 */

const { loadConfig, createPipelineManager } = require('../src/index');
const createExampleParser = require('../parsers/example-parser');

async function main() {
  console.log('Custom Parser Demo\n');

  // Load config
  const config = loadConfig();

  // Create pipeline
  const pipeline = createPipelineManager(config);
  pipeline.init();

  // Register custom parser manually
  pipeline.parserRegistry.register('example', createExampleParser);
  console.log('Registered custom parser: example\n');

  // Listen for clearance messages
  pipeline.on('clearance', (parsed) => {
    console.log('\n=== Clearance Received ===');
    console.log(`From: ${parsed.from}`);
    console.log(`To: ${parsed.to}`);
    console.log(`Type: ${parsed.clearanceType}`);

    if (parsed.details.runway) {
      console.log(`Runway: ${parsed.details.runway}`);
    }

    if (parsed.details.altitude) {
      console.log(`Altitude: ${parsed.details.altitude.value} ${parsed.details.altitude.unit}`);
    }

    console.log(`Details: ${parsed.details.raw}`);
  });

  // Simulate incoming messages (for demo purposes)
  console.log('Simulating incoming messages...\n');

  const testMessages = [
    {
      port: 6809,
      parser: 'example',
      data: '#CLR:JFK_TWR:UAL123:TKOF:CLEARED TAKEOFF RWY 31L WIND 320/15'
    },
    {
      port: 6809,
      parser: 'example',
      data: '#CLR:JFK_GND:AAL456:TAXI:TAXI TO RWY 22R VIA A, B, C'
    },
    {
      port: 6809,
      parser: 'example',
      data: '#CLR:NYC_APP:DAL789:CLMB:CLIMB AND MAINTAIN FL250'
    }
  ];

  // Process test messages
  testMessages.forEach((captureData, index) => {
    setTimeout(async () => {
      const parser = pipeline.parserRegistry.create(captureData.parser);

      if (parser.canHandle(captureData.data)) {
        const parsed = parser.parse(captureData.data);

        if (parsed) {
          const enriched = {
            ...parsed,
            port: captureData.port,
            parserName: captureData.parser
          };

          await pipeline.eventPipeline.processMessage(enriched);
        }
      }
    }, index * 2000);
  });

  // Keep alive
  setTimeout(() => {
    console.log('\n\nDemo complete');
    process.exit(0);
  }, 10000);
}

main().catch(console.error);

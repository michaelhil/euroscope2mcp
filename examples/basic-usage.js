/**
 * basic-usage.js
 * Example of using euroscope2mcp to capture and parse VATSIM traffic
 */

const { createEuroscopePipeline } = require('../src/index');

// Create pipeline
const pipeline = createEuroscopePipeline({
  interface: 'Ethernet',
  port: 6809
});

console.log('EuroScope to MCP - Live Traffic Monitor');
console.log('='.repeat(60));
console.log('');

// Listen for important events
pipeline.on('started', (info) => {
  console.log(`✅ Capture started`);
  console.log(`   Interface: ${info.interface}`);
  console.log(`   Port: ${info.port}`);
  console.log('');
  console.log('Waiting for VATSIM traffic...\n');
});

// Text messages (clearances, communications)
pipeline.on('text_message', (data) => {
  console.log('\n🗨️  TEXT MESSAGE');
  console.log(`   From: ${data.from}`);
  console.log(`   To: ${data.to}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
});

// Flight plans
pipeline.on('flight_plan', (data) => {
  console.log(`\n✈️  FLIGHT PLAN: ${data.callsign}`);
  console.log(`   Route: ${data.data.substring(0, 80)}...`);
  console.log('');
});

// Controller positions
pipeline.on('controller_position', (data) => {
  console.log(`\n👨‍✈️ CONTROLLER: ${data.callsign}`);
  console.log(`   Frequency: ${(data.frequency / 1000).toFixed(3)} MHz`);
  console.log(`   Position: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`);
  console.log('');
});

// Position updates (only log occasionally)
let positionCount = 0;
pipeline.on('position_slow', (data) => {
  positionCount++;
  if (positionCount % 50 === 0) {
    console.log(`📍 Positions: ${positionCount} aircraft tracked`);
  }
});

// Pilot authentication (new aircraft joining)
pipeline.on('auth_pilot', (data) => {
  console.log(`\n✈️  NEW PILOT: ${data.callsign}`);
  console.log(`   Name: ${data.realName}`);
  console.log(`   CID: ${data.cid}`);
  console.log('');
});

// Error handling
pipeline.on('error', (err) => {
  console.error('\n❌ Error:', err.message);
});

// Show stats every 30 seconds
setInterval(() => {
  const status = pipeline.getStatus();
  const stats = status.parser;

  console.log('\n' + '─'.repeat(60));
  console.log('📊 STATISTICS');
  console.log('─'.repeat(60));
  console.log(`Total messages: ${stats.total}`);
  console.log(`Message types:`);

  Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([type, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      console.log(`  ${type.padEnd(25)} ${count.toString().padStart(6)} (${percentage}%)`);
    });
  console.log('─'.repeat(60) + '\n');
}, 30000);

// Start capturing
try {
  pipeline.start();
} catch (err) {
  console.error('Failed to start:', err.message);
  console.error('\nMake sure:');
  console.error('1. Wireshark/tshark is installed');
  console.error('2. EuroScope is connected to VATSIM');
  console.error('3. You have the correct network interface name');
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  pipeline.stop();

  const finalStats = pipeline.getStatus();
  console.log(`\nFinal stats: ${finalStats.parser.total} messages processed`);

  process.exit(0);
});

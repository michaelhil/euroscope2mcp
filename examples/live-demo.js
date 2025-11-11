/**
 * live-demo.js
 * Simple working demo showing live VATSIM traffic
 */

const { spawn } = require('child_process');
const { createFsdParser } = require('./src/parser/fsd-parser');

console.log('EuroScope to MCP - Live Demo');
console.log('='.repeat(60));
console.log('Starting capture on port 6809...\n');

const parser = createFsdParser();

// Listen for interesting events
parser.on('text_message', (data) => {
  console.log('\n🗨️  TEXT MESSAGE (Clearance)');
  console.log(`   From: ${data.from}`);
  console.log(`   To: ${data.to}`);
  console.log(`   Message: ${data.message}`);
});

parser.on('flight_plan', (data) => {
  console.log(`\n✈️  FLIGHT PLAN: ${data.callsign}`);
  console.log(`   Route: ${data.data.substring(0, 80)}...`);
});

parser.on('controller_position', (data) => {
  console.log(`\n👨‍✈️ CONTROLLER: ${data.callsign}`);
  console.log(`   Frequency: ${(data.frequency / 1000).toFixed(3)} MHz`);
});

parser.on('auth_pilot', (data) => {
  console.log(`\n✈️  PILOT JOIN: ${data.callsign} (${data.realName})`);
});

// Count position updates
let posCount = 0;
parser.on('position_slow', () => posCount++);
parser.on('position_fast', () => posCount++);

// Show stats every 15 seconds
setInterval(() => {
  const stats = parser.getStats();
  console.log(`\n📊 Total: ${stats.total} messages (${posCount} positions)`);
}, 15000);

// Start tshark
const tshark = spawn('C:\\Program Files\\Wireshark\\tshark.exe', [
  '-i', 'Ethernet',
  '-f', 'tcp port 6809',
  '-T', 'fields',
  '-e', 'data.text',
  '-l'
]);

// Feed data to parser
tshark.stdout.on('data', (chunk) => {
  parser.processData(chunk.toString('utf-8'));
});

tshark.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('Capturing')) {
    console.log('✅ Capture started! Waiting for VATSIM traffic...\n');
  }
});

tshark.on('error', (err) => {
  console.error('❌ tshark error:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  tshark.kill();
  const stats = parser.getStats();
  console.log(`Final: ${stats.total} messages processed`);
  process.exit(0);
});

/**
 * raw-demo.js
 * Demonstrates raw FSD messages and how we parse them
 */

const { createFsdParser } = require('./src/parser/fsd-parser');

console.log('FSD PROTOCOL RAW MESSAGE EXAMPLES');
console.log('='.repeat(80));
console.log('');

// Create parser
const parser = createFsdParser();

// Collect parsed results
const results = [];
parser.on('message', (data) => {
  results.push(data);
});

// 10 real example messages from VATSIM
const rawMessages = [
  // 1. Text message (clearance request)
  '#TMMH_OBS:FP:UAL21E GET',

  // 2. Flight plan
  '$FPUAL21E:*A:I:B77W/H-SDE1E2E3FGHIJ2J3J4J5M1RWXY/LB1D1:484:EGLL:1155:1155:34000:KBOS:6:50:8:24:CYQX:PBN/A1B1C1D1L1O1S2 DOF/251110 REG/N784UA EET/EGGX0040 CZQX0352 CZQM0520 RMK/TCAS SIMBRIEF',

  // 3. Controller position
  '%EKDK_CTR:36555:4:100:1:55.62000:12.65000:30000',

  // 4. Pilot authentication
  '#APDLH9PZ:@94836:1234567::25000:1:100:Peter Zopes',

  // 5. Client query (aircraft config with JSON)
  '$CQCXA1497:@94836:ACC:{"config":{"gear_down":false}}',

  // 6. Slow position update
  '@S:BAW42Y:1000:1:51.47000:-0.46000:12500:350:4193976:45',

  // 7. Fast position update
  '@N:SAS59Z:2271:1:59.02123:15.63167:29099:468:8385232:45',

  // 8. Position transmission (high precision)
  '#STVIR10:55.6252100:12.6518300:35.14:0.23:4192252:0.00',

  // 9. Broadcast text message
  '#TMESGG_E_APP:@24680:All stations, Göteborg Approach is closed. Monitor 122.8',

  // 10. Pilot with multiple embedded messages
  '#APAOJ750:@94836:7890123::25000:1:100:Borzo'
];

console.log('Processing 10 raw FSD messages...\n');

rawMessages.forEach((raw, index) => {
  // Parse the message
  parser.processData(raw + '\r\n');

  const parsed = results[index];

  console.log(`[${ (index + 1).toString().padStart(2, '0')}] RAW MESSAGE:`);
  console.log(`    ${raw}`);
  console.log('');
  console.log(`    MESSAGE TYPE: ${parsed.type}`);
  console.log(`    PARSED DATA:`);

  // Pretty print parsed data
  const dataStr = JSON.stringify(parsed.parsed, null, 6);
  const lines = dataStr.split('\n');
  lines.forEach(line => {
    console.log(`    ${line}`);
  });

  console.log('');
  console.log('-'.repeat(80));
  console.log('');
});

// Show parsing summary
console.log('\n📊 PARSING SUMMARY\n');
console.log('FSD Protocol Format:');
console.log('  - Fields separated by colons (:)');
console.log('  - Messages end with \\r\\n');
console.log('  - First 2-3 characters identify message type:');
console.log('');
console.log('  #TM = Text Message');
console.log('  $FP = Flight Plan');
console.log('  $CQ = Client Query (with JSON data)');
console.log('  %   = Controller Position');
console.log('  #AP = Auth Pilot');
console.log('  @S  = Slow Position Update');
console.log('  @N  = Fast Position Update');
console.log('  #ST = Position Transmission');
console.log('');
console.log('Parser extracts structured data from colon-delimited format');
console.log('and emits typed events for easy consumption.');

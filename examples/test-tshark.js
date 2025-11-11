// Quick diagnostic to see if tshark is working
const { spawn } = require('child_process');

console.log('Testing tshark...\n');

const tshark = spawn('C:\\Program Files\\Wireshark\\tshark.exe', [
  '-i', 'Ethernet',
  '-f', 'tcp port 6809',
  '-T', 'fields',
  '-e', 'data.text',
  '-c', '5'  // Capture just 5 packets
]);

tshark.stdout.on('data', (data) => {
  console.log('✅ Got data:');
  console.log(data.toString());
});

tshark.stderr.on('data', (data) => {
  console.log('ℹ️  tshark says:', data.toString());
});

tshark.on('close', (code) => {
  console.log(`\ntshark exited with code: ${code}`);
  if (code === 0) {
    console.log('✅ tshark is working!');
  } else {
    console.log('❌ tshark failed - may need admin privileges');
  }
});

tshark.on('error', (err) => {
  console.error('❌ Error spawning tshark:', err.message);
});

console.log('Waiting for 5 packets...\n');

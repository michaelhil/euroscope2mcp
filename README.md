# euroscope2mcp

Packet capture and parser for VATSIM FSD protocol traffic from EuroScope.

## Description

This tool captures network traffic between EuroScope and VATSIM servers on port 6809, parses the FSD (Flight Simulator Display) protocol, and emits structured events. Uses tshark for packet capture and Node.js EventEmitter for event streaming.

## Architecture

```
EuroScope ←→ VATSIM (port 6809)
      ↓
   tshark
      ↓
capture module (hex decode)
      ↓
parser module (FSD protocol)
      ↓
EventEmitter (typed events)
```

## Requirements

- Node.js 14+
- Wireshark/tshark
- EuroScope connected to VATSIM

## Installation

```bash
npm install
```

No runtime dependencies. Uses Node.js built-in modules only.

## Usage

```javascript
const { createEuroscopePipeline } = require('./src/index');

const pipeline = createEuroscopePipeline({
  interface: 'Ethernet',  // network interface name
  port: 6809              // VATSIM FSD port
});

pipeline.on('text_message', (data) => {
  console.log(`${data.from} → ${data.to}: ${data.message}`);
});

pipeline.on('flight_plan', (data) => {
  console.log(`Flight plan: ${data.callsign}`);
});

pipeline.start();
```

Run examples:

```bash
# Full example with event handling and statistics
node examples/basic-usage.js

# Simple live demo
node examples/live-demo.js

# FSD protocol parsing examples with raw messages
node examples/raw-demo.js

# Test tshark installation
node examples/test-tshark.js
```

## Events

| Event | Description | Data Fields |
|-------|-------------|-------------|
| `text_message` | ATC clearances, communications | `from`, `to`, `message` |
| `flight_plan` | Complete flight plans | `callsign`, `data` |
| `position_slow` | Slow position updates | `callsign`, `latitude`, `longitude`, `altitude`, etc. |
| `position_fast` | Fast position updates | Same as slow |
| `controller_position` | Active ATC positions | `callsign`, `frequency`, `latitude`, `longitude` |
| `auth_pilot` | Pilot connections | `callsign`, `realName`, `cid` |
| `client_query` | Aircraft config (JSON) | `from`, `to`, `queryType`, `payload` |

## FSD Protocol

FSD message format:

```
COMMAND:FROM:TO:FIELD1:FIELD2:...
```

Supported message types:

| Prefix | Type | Fields |
|--------|------|--------|
| `#TM` | Text message | from, to, message |
| `$FP` | Flight plan | callsign, rules, aircraft, speed, departure, etc. |
| `%` | Controller position | callsign, frequency, facility, visibility range, rating, lat, lon |
| `@S` | Slow position update | callsign, transponder, rating, lat, lon, altitude, groundspeed |
| `@N` | Fast position update | Same as slow |
| `#AP` | Pilot auth | callsign, server, cid, password, rating, protocol, simtype, realname |
| `$CQ` | Client query | from, to, queryType, payload (JSON) |

## tshark Setup

### Windows

Install Wireshark from https://www.wireshark.org/download.html

Add to PATH or specify location:

```javascript
createEuroscopePipeline({
  tsharkPath: 'C:\\Program Files\\Wireshark\\tshark.exe'
});
```

### Linux

```bash
sudo apt-get install tshark
sudo usermod -a -G wireshark $USER
```

Log out and back in for group changes to apply.

### Verify Installation

```bash
tshark --version
```

### Finding Network Interface

Windows:
```bash
tshark -D
```

Example output:
```
1. \Device\NPF_{...} (Ethernet)
2. \Device\NPF_{...} (Wi-Fi)
```

Use the interface name (e.g., `Ethernet`, `Wi-Fi`) in configuration.

## Docker

Pull from GitHub Container Registry:

```bash
docker pull ghcr.io/[username]/euroscope2mcp:latest
docker run --net=host ghcr.io/[username]/euroscope2mcp:latest
```

Or build locally:

```bash
docker build -t euroscope2mcp .
docker run --net=host euroscope2mcp
```

`--net=host` required for packet capture access.

Images automatically built on push to main branch via GitHub Actions.

## API

### `createEuroscopePipeline(options)`

Returns pipeline object with methods:

- `start()` - Start packet capture
- `stop()` - Stop packet capture
- `getStatus()` - Get capture status and message statistics
- `on(event, handler)` - Register event listener
- `once(event, handler)` - One-time listener
- `off(event, handler)` - Remove listener

Options:

- `interface` (string) - Network interface, default: `'Ethernet'`
- `port` (number) - Port to monitor, default: `6809`
- `tsharkPath` (string) - Path to tshark executable, default: auto-detect

## Troubleshooting

**"tshark not found"**

Ensure Wireshark is installed and tshark is in PATH, or specify path in options.

**"No packets captured"**

1. Verify EuroScope is connected to VATSIM
2. Check network interface name with `tshark -D`
3. Verify VATSIM connection uses port 6809 (`netstat -an | findstr 6809`)

**"Permission denied"**

Run with administrator/root privileges. tshark requires elevated permissions for packet capture.

## Project Structure

```
src/
├── capture/
│   └── tshark-capture.js  # tshark spawning, hex decoding
├── parser/
│   └── fsd-parser.js      # FSD protocol parsing
└── index.js               # Pipeline factory

examples/
└── basic-usage.js         # Example implementation
```

## License

MIT

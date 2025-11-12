# euroscope2mcp v0.2.0 - Architecture Documentation

## Overview

euroscope2mcp is a modular packet capture and parsing system designed for real-time network protocol analysis. Originally built for VATSIM's FSD protocol, it now supports multiple ports, custom parsers, and various output destinations including live web visualization and TimescaleDB storage.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      euroscope2mcp v0.2.0                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │               Capture Layer                            │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         Capture Manager                          │  │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │  │   │
│  │  │  │ tshark     │  │ tshark     │  │ tshark    │  │  │   │
│  │  │  │ Port 6809  │  │ Port 8080  │  │ Port 9000 │  │  │   │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │  │   │
│  │  └────────┼────────────────┼───────────────┼────────┘  │   │
│  └───────────┼────────────────┼───────────────┼───────────┘   │
│              │                │               │                │
│  ┌───────────▼────────────────▼───────────────▼───────────┐   │
│  │               Parser Registry                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │   FSD    │  │   Raw    │  │ Custom 1 │  │  ...   │ │   │
│  │  │  Parser  │  │  Parser  │  │  Parser  │  │        │ │   │
│  │  └─────┬────┘  └─────┬────┘  └─────┬────┘  └───┬────┘ │   │
│  └────────┼─────────────┼──────────────┼───────────┼──────┘   │
│           └─────────────┴──────────────┴───────────┘          │
│                              │                                 │
│  ┌───────────────────────────▼─────────────────────────────┐  │
│  │                  Event Pipeline                          │  │
│  │            (Central Event Bus & Router)                  │  │
│  └───────────────────────────┬─────────────────────────────┘  │
│                              │                                 │
│         ┌────────────────────┼────────────────────┐           │
│         │                    │                    │           │
│    ┌────▼──────┐      ┌──────▼──────┐     ┌──────▼──────┐   │
│    │  Web UI   │      │ TimescaleDB │     │    File     │   │
│    │ (WebSocket│      │   Writer    │     │   Logger    │   │
│    │    +      │      │  (Batched)  │     │             │   │
│    │ REST API) │      └─────────────┘     └─────────────┘   │
│    └───────────┘                                             │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
    ┌─────▼──────┐
    │  Browser   │
    │   Client   │
    └────────────┘
```

## Core Components

### 1. Capture Layer

**Location**: `src/capture/`

#### Capture Manager (`capture-manager.js`)
- Manages multiple tshark processes simultaneously
- One process per monitored port
- Handles lifecycle (start/stop/restart)
- Aggregates statistics per port
- Emits events with port metadata

**Key Features**:
- Dynamic port addition/removal
- Per-port enable/disable
- Error isolation (one port failing doesn't affect others)
- Configurable network interface

**Data Flow**:
```
Network → tshark process → stdout → line buffer → 'data' event
```

#### tshark Capture (`tshark-capture.js`)
- Spawns single tshark process
- Configurable display filter
- Line-buffered output
- Error handling and recovery

### 2. Parser Layer

**Location**: `src/parser/`

#### Parser Registry (`parser-registry.js`)
- Plugin system for parsers
- Factory pattern for parser instantiation
- Auto-loading from `./parsers/` directory
- Parser instance caching

**Parser Lifecycle**:
1. Registration: `registry.register('name', factoryFunction)`
2. Instantiation: `registry.create('name', config)`
3. Initialization: `parser.init()` (if implemented)
4. Usage: `parser.canHandle()` → `parser.parse()`

#### Base Parser (`base-parser.js`)
- Common interface for all parsers
- Helper functions (splitMessage, parseIntField, etc.)
- Metadata management
- Default implementations

**Parser Interface**:
```javascript
{
  name: string,
  canHandle(message): boolean,
  parse(message): { type, raw, parsed, timestamp },
  validate(parsed): boolean,  // Optional
  init(): void,               // Optional
  getMetadata(): object       // Provided by base
}
```

### 3. Pipeline Layer

**Location**: `src/pipeline/`

#### Event Pipeline (`event-pipeline.js`)
- Central event bus
- Distributes messages to all outputs
- Tracks statistics
- Output management (register/unregister/enable/disable)
- Error isolation per output

**Event Types**:
- `message`: All messages
- `<type>`: Type-specific (e.g., `position_fast`, `text_message`)
- `output-error`: Output processing errors

#### Pipeline Manager (`pipeline-manager.js`)
- Orchestrates all components
- Connects capture → parser → pipeline
- Configuration management
- Lifecycle coordination

**Responsibilities**:
- Initialize all subsystems
- Route capture data to appropriate parsers
- Enrich messages with metadata
- Coordinate shutdown

### 4. Output Layer

**Location**: `src/outputs/`

#### DB Writer (`db-writer.js`)
- TimescaleDB integration
- Batched writes for performance
- Multiple specialized tables
- Automatic flush on interval or batch size
- Transaction support

**Batching Strategy**:
- Buffer messages in memory
- Flush when: batch size reached OR timer expires
- Separate buffers by message type
- Single transaction per flush

**Tables**:
- `messages`: All messages (raw + parsed JSON)
- `positions`: High-frequency position updates
- `flight_plans`: Flight plan submissions
- `text_messages`: Communications
- `controller_positions`: ATC positions
- `capture_stats`: System metrics

### 5. Web Layer

**Location**: `src/web/`

#### Web Server (`server.js`)
- Bun's built-in HTTP/WebSocket server
- REST API for control
- WebSocket for real-time streaming
- Static file serving

**API Endpoints**:
- `GET /api/status`: System status
- `GET /api/parsers`: List parsers
- `POST /api/capture/start`: Start capture
- `POST /api/capture/stop`: Stop capture
- `POST /api/ports/add`: Add port
- `POST /api/ports/remove`: Remove port
- `WS /ws`: WebSocket connection

**WebSocket Protocol**:
```javascript
// Client → Server
{ type: 'subscribe', ports: [6809], messageTypes: ['all'] }
{ type: 'command', action: 'start' }
{ type: 'get-status' }

// Server → Client
{ type: 'message', data: {...} }
{ type: 'status', data: {...} }
{ type: 'command-result', action: 'start', result: {...} }
{ type: 'error', message: '...' }
```

#### Web UI (`public/`)
- Vanilla JavaScript (no framework)
- Real-time message display
- Filtering (port, type, view mode)
- Auto-scroll with pause
- Connection status indicator
- Statistics dashboard

## Data Flow

### Message Processing Pipeline

```
1. Network Packet
   ↓
2. tshark captures → TCP reassembly → text extraction
   ↓
3. Capture Manager → adds port metadata
   ↓
4. Pipeline Manager → routes to parser
   ↓
5. Parser Registry → finds appropriate parser
   ↓
6. Parser → parse() → returns structured data
   ↓
7. Pipeline Manager → enriches with metadata
   ↓
8. Event Pipeline → broadcasts to outputs
   ↓
9. Multiple Outputs (parallel):
   ├─ WebSocket → broadcasts to all clients
   ├─ DB Writer → batches and writes to TimescaleDB
   └─ File Logger → appends to log file
```

### Message Structure Evolution

```javascript
// 1. Raw capture
"@N:UAL123:1200:1:40.7128:-74.0060:35000:450:..."

// 2. With port metadata
{
  port: 6809,
  parser: "fsd",
  label: "VATSIM FSD",
  data: "@N:UAL123:1200:1:40.7128:-74.0060:35000:450:..."
}

// 3. After parsing
{
  type: "POSITION_FAST",
  raw: "@N:UAL123:1200:1:40.7128:-74.0060:35000:450:...",
  parsed: {
    callsign: "UAL123",
    squawk: "1200",
    rating: 1,
    latitude: 40.7128,
    longitude: -74.0060,
    altitude: 35000,
    groundSpeed: 450,
    pbh: "...",
    flags: "..."
  },
  timestamp: 1705123456789
}

// 4. Enriched for pipeline
{
  type: "POSITION_FAST",
  raw: "@N:UAL123:1200:1:40.7128:-74.0060:35000:450:...",
  parsed: { ... },
  timestamp: 1705123456789,
  port: 6809,
  parserName: "fsd"
}
```

## Configuration System

**Location**: `src/config/`

### Configuration Hierarchy

1. **Default Config** (`default-config.js`)
   - Hardcoded defaults
   - Always loaded first

2. **User Config** (`config/config.json`)
   - User overrides
   - Merged with defaults

3. **Environment Variables**
   - Runtime overrides
   - Highest priority
   - Examples: `DB_PASSWORD`, `WEB_PORT`

### Configuration Structure

```json
{
  "capture": {
    "interface": "Ethernet",
    "tsharkPath": "...",
    "ports": [
      { "port": 6809, "parser": "fsd", "enabled": true, "label": "..." }
    ]
  },
  "parsers": {
    "fsd": { "enabled": true },
    "custom": { "option": "value" }
  },
  "outputs": {
    "web": { "enabled": true, "port": 3000, "host": "0.0.0.0" },
    "database": { "enabled": false, "host": "localhost", ... },
    "file": { "enabled": false, "path": "./logs/..." }
  },
  "logging": { "level": "info", "file": "./logs/..." }
}
```

## Parser Development

### Parser Plugin Architecture

Parsers are independent modules that:
1. Export a factory function
2. Return object implementing parser interface
3. Can be loaded dynamically
4. Receive configuration
5. Have access to helper functions

### Example Parser Structure

```javascript
function createMyParser(config = {}) {
  const base = createBaseParser({ name: 'my-parser', ...config });

  // Private state
  const lookupTable = loadLookupTable(config.lookupFile);

  return {
    ...base,

    init() {
      console.log('Parser initialized');
    },

    canHandle(message) {
      return message.startsWith('MY:');
    },

    parse(message) {
      const parts = splitMessage(message);
      return {
        type: 'MY_TYPE',
        raw: message,
        parsed: { /* extracted data */ },
        timestamp: Date.now()
      };
    }
  };
}

module.exports = createMyParser;
```

## Database Schema

### TimescaleDB Hypertables

All tables are TimescaleDB hypertables for time-series optimization:

- Automatic partitioning by time
- Compression for older data
- Continuous aggregates support
- Retention policies

### Table Design Philosophy

1. **messages**: Store everything (audit trail)
2. **Specialized tables**: Optimized for specific queries
3. **JSONB columns**: Flexible for evolving schemas
4. **Indexes**: On common query patterns

## Performance Considerations

### Batching Strategy

**DB Writer**:
- Buffer size: 100 messages (configurable)
- Flush interval: 1000ms (configurable)
- Flush triggers: size threshold OR timer
- Batch insert with single transaction

**Benefits**:
- Reduces DB round trips (100x)
- Lower latency variance
- Better throughput under load

### Memory Management

**Buffers**:
- Capture: Line buffer (< 1KB per port)
- Parser: Message buffer (< 10KB)
- DB Writer: Batch buffer (< 1MB)
- Web UI: Client-side limit (1000 messages)

### Concurrency

**Async Operations**:
- Parser processing: Synchronous (fast)
- DB writes: Async with Promise.allSettled()
- WebSocket broadcasts: Fire-and-forget
- Output errors: Isolated (don't block pipeline)

## Error Handling

### Isolation Levels

1. **Port Level**: One port error doesn't affect others
2. **Parser Level**: Parse failure returns null, continues
3. **Output Level**: One output error doesn't block others
4. **System Level**: Graceful degradation

### Error Recovery

- **tshark crash**: Automatic restart (future enhancement)
- **DB connection loss**: Buffer + retry (future enhancement)
- **WebSocket disconnect**: Auto-reconnect on client
- **Parse error**: Log and continue

## Extension Points

### Adding New Features

1. **New Parser**: Drop file in `parsers/` directory
2. **New Output**: Implement output handler function
3. **New Port**: Add to config, restart
4. **New Message Type**: Parser emits new type, pipeline routes

### Plugin Types

- **Parsers**: Message interpretation
- **Outputs**: Message destinations
- **Filters**: Message transformation (future)
- **Aggregators**: Statistics computation (future)

## Future Enhancements

1. **Parser hot-reload**: Load parsers without restart
2. **Message replay**: Record/replay for testing
3. **Metrics export**: Prometheus integration
4. **Filtering**: Server-side message filtering
5. **Rate limiting**: Backpressure handling
6. **Health checks**: Monitoring endpoints
7. **Multi-server**: Distributed capture

## Testing Strategy

### Unit Testing
- Parser functions
- Configuration merging
- Helper functions

### Integration Testing
- Capture → Parser flow
- Pipeline → Output flow
- End-to-end message processing

### Manual Testing
- Example scripts
- Web UI interaction
- Database queries

## Deployment Options

### Local Development
```bash
bun start
```

### Docker (with TimescaleDB)
```bash
cd docker
docker-compose up
```

### Production
- Use environment variables
- Enable database output
- Configure retention policies
- Set up monitoring
- Use systemd/supervisor for process management

## Security Considerations

1. **Packet Capture**: Requires elevated privileges
2. **Database**: Use strong passwords, limit network access
3. **Web UI**: No authentication (add reverse proxy + auth)
4. **Input Validation**: Parsers should validate all input
5. **SQL Injection**: Use parameterized queries (done)

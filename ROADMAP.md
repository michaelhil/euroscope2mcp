# euroscope2mcp Roadmap & Future Plans

## Completed (v0.2.0)

- ✅ Multi-port capture support
- ✅ Pluggable parser architecture
- ✅ Live web UI with WebSocket streaming
- ✅ TimescaleDB integration with batching
- ✅ Event pipeline system
- ✅ Configuration system with environment overrides
- ✅ Functional programming architecture
- ✅ Zero-dependency core (except pg)
- ✅ Comprehensive documentation

## Short Term (v0.3.0 - Next Release)

### Parser Enhancements
- [ ] **Parser hot-reload**: Reload parsers without restarting
- [ ] **Parser validation tools**: CLI tool to test parsers
- [ ] **Parser templates**: Templates for common protocol patterns
- [ ] **Parser debugging**: Debug mode with verbose logging

### Web UI Improvements
- [ ] **Message search**: Full-text search in captured messages
- [ ] **Export functionality**: Export filtered messages to JSON/CSV
- [ ] **Custom themes**: Dark/light theme toggle
- [ ] **Performance dashboard**: Real-time performance metrics
- [ ] **Parser rule builder**: Visual tool for building parse rules

### Reliability
- [ ] **Auto-restart**: Automatic tshark restart on crash
- [ ] **Health checks**: HTTP health endpoint for monitoring
- [ ] **Graceful reconnection**: DB reconnection with exponential backoff
- [ ] **Circuit breakers**: Prevent cascade failures

## Medium Term (v0.4.0-v0.8.0)

### Advanced Features

#### Message Replay System
- [ ] Record messages to file
- [ ] Replay at configurable speed
- [ ] Seek/pause/resume controls
- [ ] Use for parser development and testing

```javascript
// Record session
pipeline.enableRecording({ file: './recordings/session.jsonl' });

// Replay session
pipeline.replay({
  source: './recordings/session.jsonl',
  speed: 2.0,  // 2x speed
  from: '2025-01-01T10:00:00',
  to: '2025-01-01T11:00:00'
});
```

#### Message Filtering & Sampling
- [ ] Server-side filtering by callsign, message type
- [ ] Sampling for high-frequency messages
- [ ] Custom filter rules (regex, conditions)
- [ ] Filter configuration per port

```json
{
  "filtering": {
    "sampling": {
      "POSITION_FAST": 0.1,  // Keep 10%
      "POSITION_SLOW": 1.0   // Keep all
    },
    "callsignFilter": {
      "include": ["UAL*", "AAL*"],
      "exclude": ["TEST*"]
    },
    "customRules": [
      {
        "field": "parsed.altitude",
        "operator": ">",
        "value": 35000
      }
    ]
  }
}
```

#### Metrics & Monitoring
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates
- [ ] Performance profiling
- [ ] Memory leak detection

```
# Metrics
euroscope_messages_total{port="6809",type="POSITION_FAST"} 12470
euroscope_parse_duration_seconds{parser="fsd"} 0.000123
euroscope_db_write_duration_seconds 0.0234
euroscope_memory_bytes 52428800
```

#### Authentication & Security
- [ ] Web UI authentication (JWT/OAuth)
- [ ] API key authentication for REST API
- [ ] Role-based access control (RBAC)
- [ ] TLS/SSL support
- [ ] Rate limiting

### Parser Ecosystem

#### Parser Marketplace
- [ ] Community parser repository
- [ ] Parser installation CLI
- [ ] Parser versioning
- [ ] Parser dependencies

```bash
euroscope2mcp parser install clearance-enhanced
euroscope2mcp parser list
euroscope2mcp parser update
```

#### FSD Parser Extensions
- [ ] Comprehensive clearance code lookup tables
- [ ] Facility type mappings
- [ ] Aircraft type database integration
- [ ] Route parsing and validation
- [ ] ICAO code lookups

### Database Enhancements

#### Query Interface
- [ ] REST API for querying historical data
- [ ] SQL query builder UI
- [ ] Saved queries
- [ ] Export query results

#### Advanced Analytics
- [ ] Continuous aggregates (hourly, daily stats)
- [ ] Flight tracking analytics
- [ ] Controller activity reports
- [ ] Traffic pattern analysis

```sql
-- Example: Hourly message counts
CREATE MATERIALIZED VIEW hourly_stats
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       message_type,
       COUNT(*) as count
FROM messages
GROUP BY bucket, message_type;
```

## Long Term (v1.0.0+)

### Distributed Architecture

#### Multi-Server Support
- [ ] Distributed capture across multiple machines
- [ ] Central aggregation server
- [ ] Load balancing
- [ ] Failover support

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Capture    │     │  Capture    │     │  Capture    │
│  Server 1   │────▶│  Server 2   │────▶│  Server 3   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                  ┌────────▼─────────┐
                  │   Aggregation    │
                  │     Server       │
                  └──────────────────┘
                           │
                  ┌────────▼─────────┐
                  │   TimescaleDB    │
                  └──────────────────┘
```

#### Cloud Native
- [ ] Kubernetes deployment
- [ ] Helm charts
- [ ] Horizontal scaling
- [ ] Cloud storage integration (S3, GCS)

### Advanced Processing

#### Stream Processing
- [ ] Apache Kafka integration
- [ ] Real-time aggregation
- [ ] Complex event processing (CEP)
- [ ] Anomaly detection

#### Machine Learning
- [ ] Pattern recognition in ATC communications
- [ ] Predictive analytics
- [ ] Traffic prediction
- [ ] Clearance suggestion engine

### Protocol Support

#### Additional Protocols
- [ ] ACARS parser
- [ ] ADS-B parser
- [ ] Custom aviation protocols
- [ ] Generic TCP/UDP protocol parser

### User Experience

#### Desktop Application
- [ ] Electron-based desktop app
- [ ] Native notifications
- [ ] System tray integration
- [ ] Offline mode

#### Mobile App
- [ ] React Native mobile app
- [ ] Push notifications
- [ ] Offline viewing
- [ ] Voice alerts

## Community Requests

Submit feature requests via [GitHub Issues](https://github.com/yourusername/euroscope2mcp/issues)

### Most Requested Features
1. Parser hot-reload (planned v0.3.0)
2. Message search (planned v0.3.0)
3. Export functionality (planned v0.3.0)
4. Authentication (planned v0.5.0)
5. Message replay (planned v0.4.0)

## Technical Debt & Refactoring

### Code Quality
- [ ] Comprehensive test suite (Jest)
- [ ] E2E tests (Playwright)
- [ ] Performance benchmarks
- [ ] Code coverage >80%
- [ ] TypeScript migration (optional)

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Video tutorials
- [ ] Interactive examples
- [ ] Architecture decision records (ADRs)

### Developer Experience
- [ ] Development container (devcontainer)
- [ ] Hot reload for development
- [ ] Better error messages
- [ ] CLI tool improvements

## Performance Targets

### v0.3.0 Targets
- 50,000+ msg/sec throughput
- <0.5ms parse latency
- <5ms DB write latency (p99)
- <100MB memory usage

### v1.0.0 Targets
- 1M+ msg/sec throughput (distributed)
- <0.1ms parse latency
- <1ms DB write latency (p99)
- <200MB memory per instance

## Architecture Evolution

### v0.2.0 (Current)
```
Monolithic → Multi-Port → Plugin System
```

### v0.5.0 (Planned)
```
+ Message Filtering + Replay System + Metrics
```

### v1.0.0 (Vision)
```
+ Distributed + Cloud Native + ML Integration
```

## Breaking Changes

We aim to maintain backwards compatibility, but major versions may introduce breaking changes:

### v0.2.0 → v0.3.0
- No breaking changes planned
- New configuration fields (optional)

### v0.x → v1.0.0
- Potential parser API changes
- Configuration schema updates
- Database schema migration required

## Contributing

Want to help build these features? Check out:
1. [CONTRIBUTING.md](CONTRIBUTING.md)
2. [Good First Issues](https://github.com/yourusername/euroscope2mcp/labels/good%20first%20issue)
3. [Feature Requests](https://github.com/yourusername/euroscope2mcp/labels/enhancement)

## Version History

- **v1.0** (2025-01-10): Initial release, basic FSD parsing
- **v0.2.0** (2025-01-12): Multi-port, plugins, web UI, database
- **v0.3.0** (Planned 2025-02): Parser hot-reload, search, export
- **v0.4.0** (Planned 2025-03): Replay, filtering, metrics
- **v1.0.0** (Planned 2025-Q3): Distributed architecture

---

**This roadmap is subject to change based on community feedback and priorities.**

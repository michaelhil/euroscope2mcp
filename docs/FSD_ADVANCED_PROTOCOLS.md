# FSD Protocol Advanced Features

**Document Version**: 1.0
**Date**: 2025-11-13
**Source**: Live VATSIM FSD protocol traffic analysis
**Sample Size**: 48,833 messages captured over 1 hour via EuroScope

---

## Overview

This document catalogs advanced FSD protocol features discovered through analysis of live VATSIM traffic. These messages handle client capabilities, server responses, connection management, and pilot/controller registration.

---

## Message Type Summary

| Message Prefix | Count | Percentage | Purpose |
|----------------|-------|------------|---------|
| #ST | 19,075 | 39.1% | Station position updates |
| BATCHED | 12,966 | 26.6% | Multiple messages in one packet |
| $CQ | 11,196 | 22.9% | Client queries (see FSD_QUERY_TYPES.md) |
| #TM | 2,520 | 5.2% | Text messages |
| #PC | 1,809 | 3.7% | Pilot client protocol |
| $FP | 386 | 0.8% | Flight plans |
| % | 351 | 0.7% | Controller positions |
| #AP | 217 | 0.4% | Add pilot (auth) |
| **$CR** | **210** | **0.4%** | **Client responses** |
| #AA | 59 | 0.1% | Auth add (station) |
| #DA | 32 | 0.1% | Delete auth (disconnect) |
| **$ZR** | **12** | **0.02%** | **Server responses** |

---

## $CR - Client Response Messages

**Count**: 210 (0.4% of traffic)
**Direction**: Client → Network
**Purpose**: Respond to server queries with client information

### Format

```
$CR<FROM>:<TO>:<TYPE>:<DATA>
```

**Components**:
- `$CR` - Client Response prefix (fixed)
- `<FROM>` - Responding callsign
- `<TO>` - Target callsign (who requested)
- `<TYPE>` - Response type (RN, CAPS, ATIS)
- `<DATA>` - Response data (varies by type)

---

### CR:RN - Real Name Response

**Count**: 105 (50% of $CR messages)
**Purpose**: Provide pilot/controller real name and certificate info

**Format**:
```
$CR<FROM>:<TO>:RN:<REAL_NAME>:<CERTIFICATE>:<RATING>
```

**Examples**:
```
$CRMH_OBS:FIN8AX:RN:Michael H:Norway 2413/1-6 ENOR 20250612:1
$CRMH_OBS:NOZ634:RN:Michael H:Norway 2413/1-6 ENOR 20250612:1
$CRMH_OBS:SAS4017:RN:Michael H:Norway 2413/1-6 ENOR 20250612:1
```

**Data Fields**:
- `<REAL_NAME>`: User's real name
- `<CERTIFICATE>`: Training certificate info (division/facility/date)
  - Format: `Division CERT_NUMBER/RANGE FACILITY YYYYMMDD`
  - Example: `Norway 2413/1-6 ENOR 20250612`
- `<RATING>`: Numeric rating (1 = OBS, 2-7 = controller ratings)

**Use Cases**:
- Observer querying pilot information
- Controller identifying pilot
- Name display in radar clients

---

### CR:CAPS - Capabilities Response

**Count**: 105 (50% of $CR messages)
**Purpose**: Advertise client capabilities for feature negotiation

**Format**:
```
$CR<FROM>:<TO>:CAPS:<CAP1>=<VAL1>:<CAP2>=<VAL2>:...
```

**Examples**:
```
$CRMH_OBS:FIN8AX:CAPS:ATCINFO=1:SECPOS=1:MODELDESC=1:ONGOINGCOORD=1:TEAMSPEAK=1:ICAOEQ=1
$CRMH_OBS:EWG6QM:CAPS:VERSION=1:ATCINFO=1:MODELDESC=1:ACCONFIG=1:VISUPDATE=1
```

**Capability Flags**:

| Capability | Value | Description |
|------------|-------|-------------|
| `VERSION` | 1 | Protocol version support |
| `ATCINFO` | 1 | Supports ATC information queries |
| `SECPOS` | 1 | Supports secondary position reporting |
| `MODELDESC` | 1 | Supports aircraft model description |
| `ACCONFIG` | 1 | Supports aircraft configuration (ACC messages) |
| `VISUPDATE` | 1 | Supports visual range updates |
| `ONGOINGCOORD` | 1 | Supports ongoing coordination |
| `TEAMSPEAK` | 1 | Supports TeamSpeak integration |
| `ICAOEQ` | 1 | Supports ICAO equipment codes |
| `ATCMULTI` | 1 | Supports multiple ATC connections |

**Justification**: Key-value pairs following standardized capability names. Query-response pattern observed (`$CQ...CAPS` → `$CR...CAPS`).

---

### CR:ATIS - ATIS Voice Response

**Count**: < 1% of $CR messages
**Purpose**: Advertise ATIS voice capability

**Format**:
```
$CR<FROM>:<TO>:ATIS:<MODE>:<FEATURE>
```

**Example**:
```
$CRMH_OBS:DCLIENT3:ATIS:V:UseAFV
```

**Data Fields**:
- `<MODE>`: Voice mode (`V` = voice-capable)
- `<FEATURE>`: Voice system (`UseAFV` = Audio for VATSIM)

**Use Cases**:
- Indicating ATIS voice capability
- AFV (Audio for VATSIM) integration

---

## $ZR - Server Response Messages

**Count**: 12 (0.02% of traffic)
**Direction**: Server → Client
**Purpose**: Server authentication or challenge response

### Format

```
$ZR<CLIENT>:SERVER:<HASH>
```

**Components**:
- `$ZR` - Server Response prefix (fixed)
- `<CLIENT>` - Target client callsign
- `SERVER` - Always literal "SERVER"
- `<HASH>` - 32-character hex hash (MD5-like)

**Examples**:
```
$ZRMH_OBS:SERVER:5cb990a711f41ebc3b1f808631bf9eb7
$ZRMH_OBS:SERVER:c7fc7521601bde8b161c4757f20a981b
$ZRMH_OBS:SERVER:b5af00452d7cb2ff6b1f1ffa695d6f83
$ZRMH_OBS:SERVER:27dd4f32face3c8e56a07909014082d3
```

**Purpose Analysis**:
- Hash format matches MD5 (32 hex chars)
- Likely used for:
  - Authentication challenge/response
  - Session token validation
  - Challenge handshake

**Justification**: Server sending hash values to specific clients. Pattern consistent with authentication protocols.

---

## #AA - Auth Add (Station Registration)

**Count**: 59 (0.1% of traffic)
**Direction**: Station → Network
**Purpose**: Register new controller/ATIS station connection

### Format

```
#AA<CALLSIGN>:SERVER:<REAL_NAME>:<CID>::<RATING>:<PROTOCOL>
```

**Components**:
- `#AA` - Auth Add prefix (fixed)
- `<CALLSIGN>` - Station callsign (controller or ATIS)
- `SERVER` - Always literal "SERVER"
- `<REAL_NAME>` - Controller's real name
- `<CID>` - VATSIM CID (member ID)
- Empty field (reserved)
- `<RATING>` - Controller rating (1-7)
- `<PROTOCOL>` - Protocol version (100 or 101)

**Examples**:
```
#AALFBO_M_APP:SERVER:Romain RIVIERE:812070::7:100
#AARYR902:SERVER:Malik Belhajji:1962089::1:101
#AATRA65QA:SERVER:1641306:1641306::1:101
#AAEGLL_ATIS:SERVER:Ammaar:1556743::2:100
#AAKDAL_ATIS:SERVER:Scott Voigt:1719563::3:100
#AADAL_TWR:SERVER:Scott Voigt:1719563::3:100
```

**Rating Levels**:
- 1 = OBS (Observer)
- 2 = S1 (Student 1)
- 3 = S2 (Student 2)
- 4 = S3 (Student 3)
- 5 = C1 (Controller)
- 6 = C2 (Senior Controller)
- 7 = C3 (Senior Controller)

**Use Cases**:
- Controller station login
- ATIS station activation
- Observer connection

**Justification**: Controller callsigns (with underscores) connecting with real names and CIDs. Always sent to "SERVER".

---

## #DA - Delete Auth (Disconnection)

**Count**: 32 (0.1% of traffic)
**Direction**: Station → Network
**Purpose**: Announce station disconnection/logoff

### Format

```
#DA<CALLSIGN>:<CID>
```

**Components**:
- `#DA` - Delete Auth prefix (fixed)
- `<CALLSIGN>` - Disconnecting callsign (controller or pilot)
- `<CID>` - VATSIM CID (member ID)

**Examples**:
```
#DABAW32W:1464942
#DAEDDG_TWR:1791532
#DAEWG278:1569397
#DATRA65QA:1641306
#DAENBR__TWR:1632808
#DAMX_OBS:1567288
#DAFAPE_ATIS:1828638
#DAFAOR_GND:1634627
#DAMJB_OBS:1841406
```

**Types of Disconnections**:
- Aircraft departure (pilot disconnect): `#DABAW32W:1464942`
- Controller logoff: `#DAEDDG_TWR:1791532`
- Observer disconnect: `#DAMX_OBS:1567288`
- ATIS deactivation: `#DAFAPE_ATIS:1828638`

**Use Cases**:
- Clean disconnect announcement
- Session termination
- Remove from active connections list

**Justification**: Callsigns followed by CIDs. Observed for both aircraft and ATC stations at disconnect time.

---

## #PC - Pilot Client Protocol

**Count**: 1,809 (3.7% of traffic)
**Direction**: Server ↔ Observer/Supervisor
**Purpose**: Controller coordination and pilot handoff messages

### Format

```
#PC<FROM>:<TO>:<PROTOCOL>:<TYPE>:<AIRCRAFT>:<DATA>
```

**Components**:
- `#PC` - Pilot Client prefix (fixed)
- `<FROM>` - Sender (controller or "server")
- `<TO>` - Receiver (observer or controller)
- `<PROTOCOL>` - Protocol type (`CCP` = Controller-Client Protocol)
- `<TYPE>` - Message type (BC, IH, etc.)
- `<AIRCRAFT>` - Subject aircraft callsign
- `<DATA>` - Additional data (varies by type)

---

### PC:CCP:BC - Broadcast/Squawk Assignment

**Purpose**: Notify observers of squawk code assignments

**Format**:
```
#PCserver:<OBSERVER>:CCP:BC:<AIRCRAFT>:<SQUAWK>
```

**Examples**:
```
#PCserver:MH_OBS:CCP:BC:FIN81C:0
#PCserver:MH_OBS:CCP:BC:PTFER:0
#PCserver:MH_OBS:CCP:BC:AWE1593:2757
#PCserver:MH_OBS:CCP:BC:IBE05CC:0
#PCserver:MH_OBS:CCP:BC:BEL926:1000
#PCserver:MH_OBS:CCP:BC:SAS455:6006
#PCserver:MH_OBS:CCP:BC:THY88:6406
#PCserver:MH_OBS:CCP:BC:RCL4HB:3754
#PCserver:MH_OBS:CCP:BC:AFR91:1000
```

**Squawk Values**:
- `0` - Not assigned or VFR
- `1000` - Default IFR
- `2757`, `6006`, etc. - Assigned discrete codes

**Use Cases**:
- Observers tracking squawk assignments
- Coordination between sectors
- Radar display updates

---

### PC:CCP:IH - Initiate Handoff

**Purpose**: Notify observer of controller handoff

**Format**:
```
#PC<CONTROLLER>:<OBSERVER>:CCP:IH:<AIRCRAFT>
```

**Example**:
```
#PCEKDK_UC_CTR:MH_OBS:CCP:IH:AUA997
```

**Use Cases**:
- Observer tracking handoffs
- Sector coordination monitoring
- Training scenarios

---

## #ST - Station Position Updates

**Count**: 19,075 (39.1% of traffic)
**Direction**: Aircraft → Network
**Purpose**: Report aircraft position in station format (alternate to @N/@S)

### Format

```
#ST<CALLSIGN>:<LAT>:<LON>:<ALT_AGL>:<GS>:<FLAGS>:<VS>
```

**Components**:
- `#ST` - Station position prefix (fixed)
- `<CALLSIGN>` - Aircraft callsign
- `<LAT>` - Latitude (decimal degrees)
- `<LON>` - Longitude (decimal degrees)
- `<ALT_AGL>` - Altitude above ground level (meters)
- `<GS>` - Ground speed (meters/second)
- `<FLAGS>` - Status flags (integer)
- `<VS>` - Vertical speed (meters/second)

**Examples**:
```
#STNPV7771:60.1969500:11.1041400:681.87:0.11:3252:0.00
#STWIF282:60.2899500:5.2273400:175.82:0.02:4200468:0.00
#STGRL77W:55.6164630:12.6432700:20.44:0.30:8387548:0.00
#STSAS1280:55.7453380:9.1474930:253.66:0.12:4194264:0.00
```

**Differences from @N/@S**:
- Uses decimal degrees instead of @N format
- Reports altitude AGL (meters) not MSL (feet)
- Ground speed in m/s not knots
- Includes vertical speed explicitly

**Use Cases**:
- Detailed position reporting
- Ground station tracking
- Aircraft on ground (low speeds)

**Justification**: High-frequency position updates in alternate format. 39% of all traffic suggests this is the preferred format for many clients.

---

## Message Batching Statistics

**Batched Messages**: 12,966 (26.6% of packets)
**Average Sub-Messages per Batch**: 2-5

Batching combines multiple FSD messages in a single network packet, separated by `\r\n`:

```
#AA<station_info>\r\n
@N:<position_update>\r\n
$CQ<query>\r\n
#ST<station_position>\r\n
```

**Most Common Batch Patterns**:
1. `#AA` + `@N` + `$CQ` + `#ST` - Station registration with initial data
2. `#DA` + `@N` + `#ST` - Disconnection with final position
3. `$CQ` + `#ST` + `@N` - Query with position updates

---

## Capability Negotiation Flow

### 1. Capability Query (Client → Target)
```
$CQ<OBSERVER>:<AIRCRAFT>:CAPS
```
Example: `$CQMH_OBS:FIN8AX:CAPS`

### 2. Capability Response (Target → Client)
```
$CR<AIRCRAFT>:<OBSERVER>:CAPS:ATCINFO=1:SECPOS=1:MODELDESC=1:...
```
Example: `$CRFIN8AX:MH_OBS:CAPS:ATCINFO=1:SECPOS=1:MODELDESC=1:ONGOINGCOORD=1:TEAMSPEAK=1:ICAOEQ=1`

### 3. Real Name Query (Client → Target)
```
$CQ<OBSERVER>:<AIRCRAFT>:RN
```

### 4. Real Name Response (Target → Client)
```
$CR<AIRCRAFT>:<OBSERVER>:RN:<NAME>:<CERT>:<RATING>
```
Example: `$CRFIN8AX:MH_OBS:RN:Michael H:Norway 2413/1-6 ENOR 20250612:1`

This handshake establishes:
- What features the client supports
- Who the pilot/controller is
- Their certification level

---

## Protocol Implementation Notes

### Parser Recommendations

1. **$CR Messages**:
   - Split by colon, parse type field
   - Handle RN, CAPS, ATIS variants
   - Parse CAPS as key=value pairs

2. **$ZR Messages**:
   - Validate hash format (32 hex chars)
   - Store for authentication tracking
   - May correlate with connection events

3. **#AA/#DA Messages**:
   - Track connection/disconnection events
   - Build active station list
   - Correlate CID with callsign

4. **#PC Messages**:
   - Parse CCP protocol commands
   - Track squawk assignments
   - Monitor handoff sequences

5. **#ST Messages**:
   - Convert meters to feet for display
   - Calculate MSL from AGL if terrain data available
   - Display alongside @N/@S positions

### Database Schema Considerations

When storing in TimescaleDB:

```sql
-- Track client capabilities
CREATE TABLE client_capabilities (
    time TIMESTAMPTZ NOT NULL,
    callsign VARCHAR(20) NOT NULL,
    capabilities JSONB NOT NULL
);

-- Track connections
CREATE TABLE connections (
    time TIMESTAMPTZ NOT NULL,
    callsign VARCHAR(20) NOT NULL,
    cid INTEGER NOT NULL,
    real_name VARCHAR(100),
    event_type VARCHAR(20), -- 'connect' or 'disconnect'
    rating INTEGER
);

-- Track server responses
CREATE TABLE server_responses (
    time TIMESTAMPTZ NOT NULL,
    callsign VARCHAR(20) NOT NULL,
    hash VARCHAR(32) NOT NULL
);
```

---

## Advanced Analysis Opportunities

### 1. Network Health Monitoring
- Track $ZR challenge-response timing
- Monitor #AA/#DA rates for network stability
- Detect authentication issues

### 2. Client Capability Analysis
- Which features are most commonly supported?
- Capability adoption rates over time
- Client software identification by CAPS patterns

### 3. Connection Pattern Analysis
- Average session duration (#AA to #DA)
- Peak connection times
- Controller vs. pilot connection patterns

### 4. Squawk Code Management
- Track BC assignments over time
- Identify squawk code conflicts
- Analyze assignment patterns by sector

### 5. Position Format Usage
- @N/@S vs. #ST usage by client
- Performance comparison (packet size, frequency)
- Ground vs. airborne format preference

---

## Security Considerations

### Authentication
- $ZR hashes appear to be MD5 (32 hex chars)
- Challenge-response pattern suggests HMAC or similar
- **Recommendation**: Do not store raw authentication data

### CID Exposure
- CIDs (member IDs) are transmitted in clear text
- #AA and #DA messages expose CIDs
- **Recommendation**: Treat CIDs as PII in storage

### Real Name Privacy
- CR:RN responses contain real names
- Certificate info includes training division
- **Recommendation**: Anonymize for analysis, comply with GDPR/privacy laws

---

## References

- **Protocol**: VATSIM FSD (Flight Simulator Display) Protocol
- **Client**: EuroScope 3.x
- **Network**: VATSIM (Virtual Air Traffic Simulation Network)
- **Capture Method**: Packet capture via euroscope2mcp
- **Analysis Date**: 2025-11-13
- **Sample Period**: 1 hour of live traffic (48,833 messages)

---

## Related Documents

- [FSD_MESSAGE_TYPES.md](./FSD_MESSAGE_TYPES.md) - Basic message type reference
- [FSD_QUERY_TYPES.md](./FSD_QUERY_TYPES.md) - Client query ($CQ) command reference

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-13 | Initial documentation of advanced FSD protocol features |

---

*This document is maintained as part of the euroscope2mcp project for VATSIM FSD protocol analysis.*

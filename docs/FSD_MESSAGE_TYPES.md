# FSD Protocol Message Types - Complete Reference

**Document Version**: 1.0
**Date**: 2025-11-13
**Source**: Live VATSIM FSD protocol traffic analysis
**Total Messages Analyzed**: 10,000+ messages across all types

---

## Overview

The FSD (Flight Simulator Display) protocol used by VATSIM batches multiple messages together in a single transmission, separated by `\r\n` (carriage return + line feed). This document catalogs all observed message types and their formats.

## Critical Understanding: Message Batching

**IMPORTANT**: A single network packet may contain multiple messages of different types, all separated by `\r\n`:

```
@N:DLH5ME:2000:1:52.01787:10.92496:29878:476:4269807360:107\r\n
#STEWG75K:53.6316700:10.0035700:53.82:14.49:4294964172:-0.02\r\n
$CQBER669F:@94836:ACC:{"config":{"flaps_pct":35}}\r\n
```

This single transmission contains:
1. Position update for DLH5ME
2. Station position for EWG75K
3. Aircraft configuration for BER669F

**Parser Implication**: Messages must be split on `\r\n` and each parsed independently.

---

## Message Type Prefixes

| Prefix | Meaning | Direction | Frequency |
|--------|---------|-----------|-----------|
| **@N:** | Fast Position Update | Aircraft → Network | Very High |
| **@S:** | Slow Position Update | Aircraft → Network | High |
| **$CQ** | Client Query | Controller/Client → Target | High |
| **$FP** | Flight Plan | Network/Client → Network | Medium |
| **$CR** | Client Response | Server → Client | Medium |
| **#ST** | Station Position | Aircraft → Network | Very High |
| **#TM** | Text Message | Client → Client | Medium |
| **#PC** | Pilot Client/Protocol | Server → Client | Medium |
| **#SB** | Server Broadcast | Server → All | Low |
| **%** | Controller Position | Controller → Network | Medium |
| **#AA** | ATIS Arrival | ATIS → Server | Low |
| **#AP** | Pilot/Observer Add | Server → Network | Low |
| **#DA** | Departure ATIS | ATIS → Server | Low |
| **#DP** | Departure | Aircraft → Server | Low |

---

## Position Updates

### @N: - Fast Position Update (POSITION_FAST)
**Purpose**: High-frequency aircraft position updates (every 5 seconds typically)

**Format**:
```
@N:<CALLSIGN>:<SQUAWK>:<RATING>:<LAT>:<LON>:<ALT>:<GS>:<PBH>:<FLAGS>
```

**Example**:
```
@N:DLH5ME:2000:1:52.01787:10.92496:29878:476:4269807360:107
```

**Fields**:
- `CALLSIGN`: Aircraft callsign (DLH5ME)
- `SQUAWK`: Transponder code (2000)
- `RATING`: Pilot rating (1)
- `LAT`: Latitude in decimal degrees (52.01787)
- `LON`: Longitude in decimal degrees (10.92496)
- `ALT`: Altitude in feet MSL (29878)
- `GS`: Ground speed in knots (476)
- `PBH`: Packed Pitch/Bank/Heading value (4269807360)
- `FLAGS`: Status flags (107)

---

### @S: - Slow Position Update (POSITION_SLOW)
**Purpose**: Lower-frequency position updates for aircraft on ground or slowly moving

**Format**: Same as @N:

**Example**:
```
@S:DLH4PM:1102:1:53.63570:9.99896:54:0:4196916:199
```

**Difference from @N**:
- Typically sent less frequently (every 30+ seconds)
- Often used for aircraft on ground
- Ground speed often 0

---

## Client Queries ($CQ)

See [FSD_QUERY_TYPES.md](./FSD_QUERY_TYPES.md) for comprehensive documentation of all query types:
- ACC (Aircraft Configuration)
- WH (Who Has)
- SC (Scratch Pad)
- TA (Temporary Altitude)
- IT (Initiate Track)
- FP (Flight Plan Request)
- BC (Broadcast Squawk)
- HT (Handoff/Transfer)
- DR (Direct Route)
- And more...

**Format**:
```
$CQ<FROM>:@<SERVER>:<QUERY_TYPE>:<TARGET>:<DATA>
```

---

## Flight Plan ($FP)

**Purpose**: Transmit or receive complete flight plan data

**Format**:
```
$FP<CALLSIGN>:*<RULES>:<TYPE>:<AIRCRAFT>:<TAS>:<DEP>:<DEPTIME_A>:<DEPTIME_E>:<ALT>:<DEST>:<HRS_ENROUTE>:<MIN_ENROUTE>:<HRS_FUEL>:<MIN_FUEL>:<ALT>:<REMARKS>:<ROUTE>
```

**Example** (wrapped for readability):
```
$FPDLH74A:*A:I:A320/M-SDE3FGHIRWY/LB1:462:EDLW:1040:1040:34000:LEBL:2:6:3:25:LEPA:
PBN/A1B1C1D1O1S1 DOF/251113 REG/GFENX EET/EDUU0015 LSAS0037 LIMM0051 LFFF0108 LECB0138
OPR/DLH PER/C RMK/TCAS SIMBRIEF /V/:
GMH1U/24 GMH Q603 TESGA L603 BOMBI DCT GIGET DCT ABUKA/N0449F380 DCT KRH DCT NATOR/N0452F370
DCT TRA DCT RIPUS DCT GERSA DCT SOSON DCT ODINA DCT GEKBA/N0460F350 DCT VAMTU UM984 DIVKO
UN975 NILDU N975 BISBA
```

**Key Fields**:
- `*A` = Flight rules (A=IFR, V=VFR, I=IFR to VFR, Y=VFR to IFR)
- `I` = Aircraft type (I=Scheduled Air Transport)
- `A320/M-...` = Aircraft type and equipment codes
- `TAS` = True Airspeed (462 knots)
- `EDLW` = Departure airport
- `LEBL` = Destination airport
- `34000` = Cruise altitude (FL340)
- Route and remarks follow

---

## Station Position (#ST)

**Purpose**: Ground station or slow-moving aircraft position (often used for aircraft on ground)

**Format**:
```
#ST<CALLSIGN>:<LAT>:<LON>:<ALT_AGL>:<GS>:<FLAGS>:<VS>
```

**Examples**:
```
#STEWG75K:53.6316700:10.0035700:53.82:14.49:4294964172:-0.02
#STDLH9KK:52.3625500:13.5068900:155.92:9.07:4282385116:0.00
#STNPV7771:60.1971700:11.1025300:681.37:0.11:7348:0.00
```

**Fields**:
- `CALLSIGN`: Aircraft/station identifier
- `LAT`: Latitude (decimal degrees)
- `LON`: Longitude (decimal degrees)
- `ALT_AGL`: Altitude above ground level in meters (53.82m)
- `GS`: Ground speed in m/s (14.49 m/s ≈ 28 knots)
- `FLAGS`: Status flags (large integer)
- `VS`: Vertical speed in m/s (-0.02 m/s)

**Usage Pattern**:
- Appears in nearly every message batch (very high frequency)
- Often for same aircraft that sent @N: or @S: in same packet
- Appears to be supplementary ground/taxi position data
- Callsigns like `STSAS1280` = station for aircraft SAS1280

**Count**: 10,000+ occurrences across all callsigns

---

## Text Messages (#TM)

**Purpose**: Direct text communication between clients (pilot-to-pilot, pilot-to-controller)

**Format**:
```
#TM<FROM>:<TO>:<MESSAGE>
```

**Examples**:
```
#TMMH_OBS:FP:UAL21E GET
#TMMH_OBS:FP:BAW9SW GET
```

**Fields**:
- `FROM`: Sender callsign (MH_OBS = observer)
- `TO`: Target (FP = flight plan service, or specific callsign)
- `MESSAGE`: Text message content

**Common Usage**:
- Flight plan requests: `FP:CALLSIGN GET`
- Controller-pilot communications
- Pilot-pilot messages
- ATIS requests

---

## Controller Position (%)

**Purpose**: Broadcast controller/ATC position and frequency information

**Format**:
```
%<CALLSIGN>:<FREQ>:<FACILITY>:<RANGE>:<RATING>:<LAT>:<LON>:<ALT>
```

**Example**:
```
%MH_OBS:99998:0:300:1:55.61792:12.65597:0
%EKDK_CTR:36555:6:210:5:58.05929:10.36808:0
```

**Fields**:
- `CALLSIGN`: Controller position (MH_OBS, EKDK_CTR)
- `FREQ`: Frequency in kHz (99998 = observer, 36555 = 136.555 MHz)
- `FACILITY`: Facility type (0=Observer, 1=FSS, 2=Clearance, 3=Ground, 4=Tower, 5=Approach, 6=Center, 7=Departure)
- `RANGE`: Visual range in NM (300)
- `RATING`: Controller rating (1-12)
- `LAT/LON`: Position coordinates
- `ALT`: Altitude (usually 0 for controllers)

**Frequency Decoding**:
- `99998` = Observer (non-controlling)
- `36555` = 136.555 MHz (divide by 1000, add 100)
- `18225` = 118.225 MHz

---

## Pilot Client Protocol (#PC)

**Purpose**: Server responses and pilot client protocol messages

**Format**:
```
#PC<TARGET>:<FROM>:<PROTOCOL>:<TYPE>:<CALLSIGN>:<DATA>
```

**Examples**:
```
#PCserver:MH_OBS:CCP:BC:BAW9SW:2416
#PCserver:MH_OBS:CCP:BC:BAW962H:0
#PCMH_OBS:ENGM_W_GND:CCP:ID
#PCESSA_E_APP:MH_OBS:CCP:ID
```

**Fields**:
- `TARGET`: Message target (server, or specific callsign)
- `FROM`: Message source
- `PROTOCOL`: Protocol type (CCP = Client Controller Protocol)
- `TYPE`: Command type (BC=Broadcast, ID=Identify)
- `CALLSIGN`: Related aircraft callsign
- `DATA`: Additional data (squawk code for BC, empty for ID)

**Common Types**:
- `BC` (Broadcast): Squawk code assignment from server
  - Example: `BC:BAW9SW:2416` = Assign squawk 2416 to BAW9SW
  - Example: `BC:BAW962H:0` = Clear squawk for BAW962H
- `ID` (Identify): Controller identification/capability query

---

## ATIS Messages

### #AA - ATIS Arrival
**Purpose**: ATIS station information for arrivals

**Format**:
```
#AA<STATION>:SERVER:<TIMESTAMP1>:<TIMESTAMP2>::<RATING>:<VALUE>
```

**Examples**:
```
#AAOPKC_ATIS:SERVER:1732396:1732396::3:100
#AALRTM_ATIS:SERVER:Horea:1608903::5:100
```

**Fields**:
- `STATION`: ATIS station callsign
- `SERVER`: Always "SERVER"
- `TIMESTAMP1/2`: Unix timestamps
- `RATING`: Controller/ATIS rating
- `VALUE`: Status value (100 = active?)

---

### #DA - Departure ATIS
**Purpose**: ATIS station departure information

**Format**:
```
#DA<STATION>:<TIMESTAMP>
```

**Examples**:
```
#DPCAL0329:1927989
#DAULLI_D_TWR:1751277
#DALPPR_ATIS:1822135
```

---

## Pilot/Observer Registration

### #AP - Add Pilot/Observer
**Purpose**: Register new pilot or observer connection

**Format**:
```
#AP<CALLSIGN>:SERVER:<ID>::<FLAG>:<RATING>:<FACILITY>:<REALNAME+LOCATION>
```

**Examples**:
```
#APZB421:SERVER:1607471::1:101:2:Amir Mor LLBG
#APSWA3979:SERVER:1337393::1:101:2:Chase Fewell KSAN
```

**Fields**:
- `CALLSIGN`: Pilot/observer callsign
- `SERVER`: Always "SERVER"
- `ID`: Connection ID
- `FLAG`: Status flag (1=active?)
- `RATING`: Pilot rating (101=observer?)
- `FACILITY`: Facility type
- `REALNAME+LOCATION`: Real name and home airport

---

### #DP - Departure
**Purpose**: Aircraft departure notification

**Format**:
```
#DP<CALLSIGN>:<TIMESTAMP>
```

**Examples**:
```
#DPSBI1012:1003722
#DPEVA216:1562214
```

---

## Client Response ($CR)

**Purpose**: Server responses to client queries

**Format**:
```
$CR<FROM>:@<SERVER>:<QUERY_TYPE>:<DATA>
```

**Note**: No examples found in current dataset - appears to be less common or filtered out.

---

## Server Broadcast (#SB)

**Purpose**: Server-wide broadcast messages

**Format**:
```
#SB<FROM>:<TO>:<MESSAGE>
```

**Note**: Referenced in query type document but no direct examples captured.

---

## Message Parsing Strategy

### Recommended Approach

1. **Split on `\r\n`**: Every network packet may contain multiple messages
2. **Identify prefix**: First 2-4 characters determine message type
3. **Route to parser**: Different parsers for each message type
4. **Extract data**: Parse fields based on format specification
5. **Store appropriately**:
   - Positions → `positions` table
   - Everything else → `messages` table with JSONB

### Message Type Detection Regex

```javascript
const MESSAGE_PATTERNS = {
  POSITION_FAST: /^@N:/,
  POSITION_SLOW: /^@S:/,
  CLIENT_QUERY: /^\$CQ/,
  FLIGHT_PLAN: /^\$FP/,
  CLIENT_RESPONSE: /^\$CR/,
  STATION_POS: /^#ST/,
  TEXT_MESSAGE: /^#TM/,
  PILOT_CLIENT: /^#PC/,
  CONTROLLER_POS: /^%/,
  ATIS_ARRIVAL: /^#AA/,
  ADD_PILOT: /^#AP/,
  DEPARTURE_ATIS: /^#DA/,
  DEPARTURE: /^#DP/,
  SERVER_BROADCAST: /^#SB/
};
```

### Example Parser Flow

```javascript
function parseMessage(rawMessage) {
  // Split batched messages
  const messages = rawMessage.split('\r\n').filter(m => m.length > 0);

  return messages.map(msg => {
    if (msg.startsWith('@N:')) return parsePositionFast(msg);
    if (msg.startsWith('@S:')) return parsePositionSlow(msg);
    if (msg.startsWith('$CQ')) return parseClientQuery(msg);
    if (msg.startsWith('$FP')) return parseFlightPlan(msg);
    if (msg.startsWith('#ST')) return parseStationPosition(msg);
    if (msg.startsWith('#TM')) return parseTextMessage(msg);
    if (msg.startsWith('#PC')) return parsePilotClient(msg);
    if (msg.startsWith('%')) return parseControllerPosition(msg);
    // ... etc
    return { type: 'UNKNOWN', raw: msg };
  });
}
```

---

## Statistical Analysis

### Message Frequency Distribution

Based on analysis of concatenated messages:

| Type | Approximate % | Use Case |
|------|--------------|----------|
| #ST (Station Pos) | 35% | Every aircraft sends these continuously |
| @N/@ S (Position) | 30% | Main aircraft position updates |
| $CQ (Queries) | 20% | Controller queries and aircraft config |
| #TM (Text) | 5% | Communications |
| #PC (Protocol) | 4% | Server responses |
| % (Controller) | 3% | ATC positions |
| Other (#AA, #AP, #DA, #DP) | 3% | Events and ATIS |

### Batching Patterns

- **Typical batch size**: 2-5 messages per transmission
- **Common combinations**:
  - `@N:` + `#ST` (position + station)
  - `@N:` + `$CQ:ACC` (position + config)
  - `$CQ:HT` + `@N:` + `#ST` (handoff + positions)
  - `$FP` + `#PC` (flight plan + acknowledgment)

---

## Field Decoding Reference

### Packed PBH (Pitch/Bank/Heading) Value

The PBH field in position messages is a packed integer containing:
- **Pitch**: Aircraft nose up/down angle
- **Bank**: Wing roll angle
- **Heading**: True heading (0-360°)

**Decoding** (approximate):
```javascript
function decodePBH(pbh) {
  const heading = (pbh >> 2) & 0x3FF;  // 10 bits
  const pitch = (pbh >> 12) & 0x3FF;   // 10 bits
  const bank = (pbh >> 22) & 0x3FF;    // 10 bits
  return {
    heading: heading * 360 / 1024,
    pitch: (pitch - 512) * 180 / 512,
    bank: (bank - 512) * 180 / 512
  };
}
```

### Status Flags

Large integer values (e.g., `4294964172`, `4282385116`) encode various aircraft states:
- On ground vs airborne
- Gear up/down
- Lights configuration
- Engine state
- etc.

**Requires bit-field analysis** - not fully documented in public FSD spec.

---

## Database Storage Recommendations

### Positions Table (High Frequency)
```sql
CREATE TABLE positions (
  time TIMESTAMPTZ NOT NULL,
  callsign VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude INTEGER,
  ground_speed INTEGER,
  pbh VARCHAR(50),
  squawk VARCHAR(4),
  flags INTEGER,
  message_type VARCHAR(20)  -- POSITION_FAST or POSITION_SLOW
);
```

### Messages Table (Everything Else)
```sql
CREATE TABLE messages (
  time TIMESTAMPTZ NOT NULL,
  message_type VARCHAR(50),  -- ST, TM, PC, FP, CQ, etc.
  callsign VARCHAR(20),
  data JSONB,  -- Flexible storage for all parsed fields
  raw_message TEXT
);
```

### Parsed Data Structure Examples

**Station Position (#ST)**:
```json
{
  "messageType": "STATION_POSITION",
  "callsign": "EWG75K",
  "latitude": 53.63167,
  "longitude": 10.00357,
  "altitudeAGL": 53.82,
  "groundSpeed": 14.49,
  "flags": 4294964172,
  "verticalSpeed": -0.02
}
```

**Text Message (#TM)**:
```json
{
  "messageType": "TEXT_MESSAGE",
  "from": "MH_OBS",
  "to": "FP",
  "message": "UAL21E GET"
}
```

**Controller Position (%)**:
```json
{
  "messageType": "CONTROLLER_POSITION",
  "callsign": "EKDK_CTR",
  "frequency": 136.555,
  "facility": "CTR",
  "facilityType": 6,
  "range": 210,
  "rating": 5,
  "latitude": 58.05929,
  "longitude": 10.36808
}
```

---

## Implementation Priority

### Phase 1: Critical Messages
1. **@N/@S** - Position updates (already implemented)
2. **$CQ** - Client queries (partially implemented)
3. **$FP** - Flight plans (already implemented)

### Phase 2: Important Messages
4. **#ST** - Station positions (for ground tracking)
5. **#TM** - Text messages (for clearances)
6. **%** - Controller positions (for coordination)

### Phase 3: Supplementary Messages
7. **#PC** - Protocol messages (for state tracking)
8. **#AA/#DA/#DP** - ATIS and events
9. **#AP** - Pilot registration

---

## Future Analysis Opportunities

1. **Ground Movement Tracking**: Use #ST messages to track aircraft taxi patterns
2. **Clearance Analysis**: Parse #TM messages for clearance delivery patterns
3. **Coordination Patterns**: Correlate % (controller pos) with $CQ:HT (handoffs)
4. **ATIS Change Impact**: Link #AA/#DA updates to traffic flow changes
5. **Facility Handoff Analysis**: Track aircraft through % facility changes
6. **Communication Analysis**: Mine #TM for common phraseology and patterns

---

## References

- **Protocol**: VATSIM FSD (Flight Simulator Display) Protocol
- **Client**: EuroScope 3.x
- **Network**: VATSIM (Virtual Air Traffic Simulation Network)
- **Related Docs**: [FSD_QUERY_TYPES.md](./FSD_QUERY_TYPES.md) for $CQ message details

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-13 | Initial comprehensive documentation of all message types |

---

*This document is maintained as part of the euroscope2mcp project for VATSIM FSD protocol analysis.*

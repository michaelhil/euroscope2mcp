# FSD Protocol Query Types Reference

**Document Version**: 1.0
**Date**: 2025-11-13
**Source**: Live VATSIM FSD protocol traffic analysis
**Sample Size**: 5,753 controller messages captured via EuroScope

---

## Overview

This document catalogs all observed FSD (Flight Simulator Display) protocol query types used in VATSIM controller-to-pilot and controller-to-controller communications. These query types are part of the `$CQ` (Client Query) message format.

## Message Format

All controller queries follow this standard format:

```
$CQ<FROM>:@<SERVER>:<QUERY_TYPE>:<TARGET>:<DATA>
```

**Components**:
- `$CQ` - Client Query prefix (fixed)
- `<FROM>` - Sender callsign (controller or observer)
- `@<SERVER>` - Server ID (e.g., @94835, @94836)
- `<QUERY_TYPE>` - Two-letter query type code (see below)
- `<TARGET>` - Target callsign (aircraft or controller)
- `<DATA>` - Additional data (optional, varies by type)

**Example**:
```
$CQEDMM_ZUG_CTR:@94835:TA:AIC1549:12000
```
Munich Center assigns temporary altitude 12,000 ft to AIC1549

---

## Query Type Reference

### ACC - Aircraft Configuration
**Count**: 3,780 (65.7% of all controller messages)
**Direction**: Aircraft → Network
**Purpose**: Reports aircraft system state changes

**Format**:
```
$CQ<CALLSIGN>:@<SERVER>:ACC:<JSON_CONFIG>
```

**Examples**:
```
$CQFIN1327:@94836:ACC:{"config":{"spoilers_out":true}}
$CQDHK2507:@94836:ACC:{"config":{"spoilers_out":false}}
$CQPGT597:@94836:ACC:{"config":{"flaps_pct":30}}
$CQSAS57J:@94836:ACC:{"config":{"flaps_pct":10}}
$CQRYR7AZ:@94836:ACC:{"config":{"lights":{"landing_on":false}}}
$CQSAS1736:@94836:ACC:{"config":{"flaps_pct":30}}
$CQAFL1539:@94836:ACC:{"config":{"engines":{"1":{"is_reversing":false}}}}
```

**Data Structure**:
- JSON object containing aircraft configuration states
- Common fields: `spoilers_out`, `flaps_pct`, `lights`, `engines`, `gear`
- Used for realistic simulation and controller awareness

**Justification**: Messages consistently contain JSON configuration data about aircraft systems. High frequency matches expected position update rate.

---

### WH - Who Has (Query)
**Count**: 1,088 (18.9%)
**Direction**: Controller → Network
**Purpose**: Query which ATC station has responsibility for an aircraft

**Format**:
```
$CQ<FROM_CONTROLLER>:@<SERVER>:WH:<AIRCRAFT_CALLSIGN>
```

**Examples**:
```
$CQMH_OBS:@94835:WH:EWG6QM
$CQJZ_OBS:@94835:WH:DLH1087
$CQEDWW_M_CTR:@94835:WH:VLG73AE
```

**Use Cases**:
- Finding which sector controls an aircraft
- Coordination before initiating contact
- Tracking aircraft responsibility during transfers

**Justification**: Controller callsigns querying about specific aircraft. Context suggests ownership/responsibility inquiry.

---

### SC - Scratch Pad (Controller Note)
**Count**: 494 (8.6%)
**Direction**: Controller → Aircraft record
**Purpose**: Set controller scratch pad annotations for coordination

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:SC:<AIRCRAFT>:<NOTE>
```

**Examples**:
```
$CQLTFM_C_TWR:@94835:SC:THY6L:TAXI
$CQLTFM_C_TWR:@94835:SC:THY6L:PUSH
$CQLTFM_C_TWR:@94835:SC:THY6L:
$CQEDMM_ZUG_CTR:@94835:SC:HBLVC:ON_CONTACT
```

**Common Annotations**:
- `TAXI` - Aircraft taxiing
- `PUSH` - Aircraft pushing back
- `ON_CONTACT` - Waiting for pilot contact
- `` (empty) - Clear scratch pad

**Justification**: Controller position names with operation-specific text. Used for visual coordination on radar displays.

---

### TA - Temporary Altitude (Clearance)
**Count**: 140 (2.4%)
**Direction**: Controller → Aircraft
**Purpose**: Assign temporary/interim altitude restriction

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:TA:<AIRCRAFT>:<ALTITUDE>
```

**Examples**:
```
$CQEDMM_ZUG_CTR:@94835:TA:AIC1549:12000
$CQEDDB_S_APP:@94835:TA:N29DE:10000
$CQLPPC_CTR:@94835:TA:HFM878:24000
$CQEDYY_JL_CTR:@94835:TA:EWG4NP:0
```

**Notes**:
- Altitude in feet (FL format: 12000 = FL120)
- `0` means cancel temporary altitude
- Often used with FA (Final Altitude) for climb/descent clearances

**Justification**: Controller issuing altitude values to aircraft. Numeric format matches altitude conventions.

---

### IT - Initiate Track/Contact
**Count**: 52 (0.9%)
**Direction**: Controller → System
**Purpose**: Initiate radar track/contact with aircraft

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:IT:<AIRCRAFT>
```

**Examples**:
```
$CQEDMM_ZUG_CTR:@94835:IT:AIC1549
$CQLPPC_CTR:@94835:IT:HFM878
$CQEDMM_ZUG_CTR:@94835:IT:THY4T
```

**Use Cases**:
- Starting radar service
- Accepting handoff
- Beginning track responsibility

**Justification**: Controller-to-aircraft with no additional data. Context suggests service initiation.

---

### FP - Flight Plan Request
**Count**: 51 (0.9%)
**Direction**: Observer/Controller → Server
**Purpose**: Request flight plan data for specific aircraft

**Format**:
```
$CQ<REQUESTER>:SERVER:FP:<AIRCRAFT>
```

**Examples**:
```
$CQMH_OBS:SERVER:FP:EWG6QM
$CQMH_OBS:SERVER:FP:DLH494
$CQMH_OBS:SERVER:FP:RYR2126
```

**Notes**:
- Target is always `SERVER` (not another controller)
- Commonly used by observers
- Server responds with full `$FP` (Flight Plan) message

**Justification**: Explicit target "SERVER" with "FP" code. Requesting aircraft-specific flight plan data.

---

### BC - Broadcast (Squawk Assignment)
**Count**: 44 (0.8%)
**Direction**: Controller → Aircraft
**Purpose**: Assign transponder squawk code

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:BC:<AIRCRAFT>:<SQUAWK>
```

**Examples**:
```
$CQEDLW_TWR:@94835:BC:DLH74A:2556
$CQEDDH_TWR:@94835:BC:AFR5:1000
$CQEDDH_TWR:@94835:BC:AFR5:5174
```

**Notes**:
- Squawk codes are 4-digit octal (0000-7777)
- Often followed by flight plan in same message
- Critical for radar identification

**Justification**: Tower/approach controllers issuing 4-digit codes matching squawk format.

---

### HT - Handoff/Transfer
**Count**: 38 (0.7%)
**Direction**: Controller → Controller
**Purpose**: Transfer aircraft control to another sector

**Format**:
```
$CQ<FROM_CONTROLLER>:@<SERVER>:HT:<AIRCRAFT>:<TO_CONTROLLER>
```

**Examples**:
```
$CQEDDB_S_APP:@94835:HT:N29DE:EDWW_M_CTR
$CQENBR__TWR:@94835:HT:LHA14L:ENBR_W_APP
$CQLIMM_ANE_APP:@94835:HT:RYR25G:LIMM_ADE_APP
```

**Transfer Patterns**:
- TWR → APP (tower to approach)
- APP → CTR (approach to center)
- CTR → CTR (center to center)

**Justification**: Controller-to-controller communication with target controller callsign. Classic handoff pattern.

---

### DR - Direct Route (Request/Clearance)
**Count**: 25 (0.4%)
**Direction**: Controller → Aircraft
**Purpose**: Grant/request direct routing clearance

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:DR:<AIRCRAFT>
```

**Examples**:
```
$CQEGLL_N_APP:@94835:DR:BAW9SW
$CQEKDK_CTR:@94835:DR:SWR517
$CQEDMM_ZUG_CTR:@94835:DR:HBLVC
```

**Use Cases**:
- Clearing aircraft direct to waypoint
- Shortcut clearances
- Vector termination

**Justification**: Controller command to aircraft without additional parameters. Routing-related context.

---

### NEWATIS - New ATIS (Broadcast)
**Count**: 10 (0.2%)
**Direction**: ATIS Station → Network
**Purpose**: Broadcast new ATIS information code and weather

**Format**:
```
$CQ<ATIS_STATION>:@<SERVER>:NEWATIS:<CODE>:<WEATHER>
```

**Examples**:
```
$CQLTFM_A_ATIS:@94835:NEWATIS:W:34011KT Q1023
$CQLRTM_ATIS:@94835:NEWATIS:A:01001KT Q1023
```

**Data Format**:
- `<CODE>`: ATIS letter (A-Z)
- `<WEATHER>`: Wind and QNH (e.g., `34011KT Q1023`)
  - `34011KT` = wind from 340° at 11 knots
  - `Q1023` = QNH 1023 hPa

**Justification**: ATIS station callsigns broadcasting weather data with letter codes.

---

### FA - Final Altitude (Clearance)
**Count**: 8 (0.1%)
**Direction**: Controller → Aircraft
**Purpose**: Clear aircraft to final/cruise altitude

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:FA:<AIRCRAFT>:<ALTITUDE>
```

**Examples**:
```
$CQEDMM_ZUG_CTR:@94835:FA:THY4T:33000
$CQEDMM_ZUG_CTR:@94835:FA:THY4T:34000
$CQEDYY_JL_CTR:@94835:FA:EWG4NP:34000
```

**Usage Pattern**:
Often paired with TA to sequence climb:
```
FA:THY4T:33000  (clear to FL330)
TA:THY4T:34000  (then clear to FL340)
```
Or to cancel temporary restriction:
```
FA:THY4T:34000  (clear to FL340)
TA:THY4T:0      (cancel temporary altitude)
```

**Justification**: Altitude clearance format similar to TA but represents final cruise level.

---

### VT - Voice Type (Communication Mode)
**Count**: 7 (0.1%)
**Direction**: Controller → Aircraft
**Purpose**: Set voice communication capability/mode

**Format**:
```
$CQ<CONTROLLER>:@<SERVER>:VT:<AIRCRAFT>:<MODE>
```

**Examples**:
```
$CQEDMM_ZUG_CTR:@94835:VT:OCN79M:t
$CQEDDS_TWR:@94835:VT:UAE157:v
$CQEDDS_TWR:@94835:VT:DLH2626:v
```

**Mode Values**:
- `t` = Text-only (no voice)
- `v` = Voice-capable
- `r` = Receive-only (unconfirmed)

**Justification**: Single character flags following aircraft callsign. Context suggests communication capability.

---

### ATC - ATC Query
**Count**: 2 (0.03%)
**Direction**: Observer → Server
**Purpose**: Query ATC station information

**Format**:
```
$CQ<REQUESTER>:SERVER:ATC:<STATION>
```

**Examples**:
```
$CQMH_OBS:SERVER:ATC:ESSA_E_APP
$CQMH_OBS:SERVER:ATC:PER01
```

**Notes**:
- Similar to FP but queries controller info
- Target is SERVER
- Used by observers/supervisors

**Justification**: Querying controller station details from server.

---

### NEWINFO - New Information (Broadcast)
**Count**: 1 (0.02%)
**Direction**: ATIS/Information Station → Network
**Purpose**: Broadcast new information code (non-weather)

**Format**:
```
$CQ<INFO_STATION>:@<SERVER>:NEWINFO:<CODE>
```

**Example**:
```
$CQEBCI_ATIS:@94835:NEWINFO:E
```

**Notes**:
- Similar to NEWATIS but for information changes
- Single letter code update
- Less common than NEWATIS

**Justification**: Information station broadcasting code update without weather.

---

## Invalid/Corrupt Entries

The following entries were found in the database but appear to be parsing errors where multiple messages were concatenated:

| Entry | Count | Issue |
|-------|-------|-------|
| `ATIS\r\n@N` | 1 | ATIS code concatenated with position message |
| `BY\r\n@S` | 1 | Unknown code with position message |
| `CAPS\r\n$CQDLH1TN` | 1 | CAPS query split incorrectly |
| `CAPS\r\n$CQRYR199` | 1 | CAPS query split incorrectly |
| `RN\r\n#STN327FX` | 1 | RN code with station message |
| `RN\r\n$CQRYR7AC` | 1 | RN code split incorrectly |
| `RN\r\n$FPN312CL` | 1 | RN code with flight plan |

**Recommendation**: These should be handled by the parser as separate messages split by `\r\n`.

---

## Statistical Summary

| Category | Count | Percentage |
|----------|-------|------------|
| Aircraft Config (ACC) | 3,780 | 65.7% |
| Coordination (WH, SC, HT) | 1,620 | 28.2% |
| Clearances (TA, FA, BC) | 192 | 3.3% |
| Operations (IT, DR, VT) | 84 | 1.5% |
| Information (FP, ATC, NEWATIS, NEWINFO) | 64 | 1.1% |
| Invalid/Corrupt | 7 | 0.1% |
| **Total** | **5,753** | **100%** |

---

## Query Type Priority by Function

### High Frequency (Real-time Operations)
1. **ACC** - Continuous aircraft state updates
2. **WH** - Frequent coordination queries

### Medium Frequency (Active Control)
3. **SC** - Scratch pad annotations
4. **TA** - Altitude clearances
5. **IT** - Contact initiation
6. **FP** - Flight plan requests

### Low Frequency (Specific Events)
7. **BC** - Squawk assignments
8. **HT** - Handoffs
9. **DR** - Direct route clearances
10. **FA** - Final altitude clearances

### Very Low Frequency (Administrative)
11. **NEWATIS** - ATIS updates
12. **VT** - Voice type settings
13. **ATC** - Controller queries
14. **NEWINFO** - Information updates

---

## Implementation Notes

### Parser Recommendations

1. **ACC Messages**: Parse JSON data for aircraft configuration state
2. **Altitude Messages (TA/FA)**: Parse as integer feet, handle `0` as cancel
3. **Handoffs (HT)**: Extract both source and target controller callsigns
4. **Scratch Pad (SC)**: Handle empty strings as "clear" command
5. **ATIS (NEWATIS)**: Parse weather format (wind + QNH)
6. **Voice Type (VT)**: Map single character to enum (text/voice/receive)

### Database Schema Considerations

When storing these in TimescaleDB:
- Store `queryType` as indexed VARCHAR for filtering
- Store aircraft callsign separately for queries
- Store controller callsigns (from/to) for coordination analysis
- Parse altitude values to integer for range queries
- Keep raw message for debugging

### Future Analysis Opportunities

1. **Traffic Pattern Analysis**: Track handoff flows between sectors
2. **Workload Metrics**: Count clearances per controller per time period
3. **Coordination Patterns**: Analyze WH→HT sequences
4. **Altitude Profiles**: Track TA/FA sequences for climb/descent patterns
5. **ATIS Changes**: Correlate weather changes with traffic patterns

---

## References

- **Protocol**: VATSIM FSD (Flight Simulator Display) Protocol
- **Client**: EuroScope 3.x
- **Network**: VATSIM (Virtual Air Traffic Simulation Network)
- **Capture Method**: Packet capture via euroscope2mcp
- **Analysis Date**: 2025-11-13
- **Sample Period**: Multiple hours of live traffic

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-13 | Initial documentation based on 5,753 message analysis |

---

*This document is maintained as part of the euroscope2mcp project for VATSIM FSD protocol analysis.*

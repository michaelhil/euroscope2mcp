# Custom Parser Development Guide

This directory is for user-defined parsers. Parsers placed here will be automatically loaded by euroscope2mcp on startup.

## Parser API

### Basic Structure

A parser is a factory function that returns a parser object implementing the required interface:

```javascript
/**
 * my-parser.js
 * Custom parser for my protocol
 */

const { createBaseParser } = require('../src/parser/base-parser');

function createMyParser(config = {}) {
  const base = createBaseParser({
    name: 'my-parser',
    version: '1.0.0',
    description: 'My custom protocol parser',
    ...config
  });

  return {
    ...base,

    // Required: Check if this parser should handle the message
    canHandle(message) {
      // Return true if this parser can parse this message
      return message.startsWith('MY_PREFIX');
    },

    // Required: Parse the message
    parse(message) {
      // Parse logic here
      const parsed = {
        // Your parsed data structure
      };

      return {
        type: 'MY_MESSAGE_TYPE',
        raw: message,
        parsed,
        timestamp: Date.now()
      };
    },

    // Optional: Validate parsed message
    validate(parsed) {
      return parsed !== null;
    }
  };
}

module.exports = createMyParser;
```

## Required Functions

### `canHandle(message)`

Determines if this parser should process the message.

- **Parameters**: `message` (string) - Raw message text
- **Returns**: `boolean` - True if parser can handle this message
- **Example**:
  ```javascript
  canHandle(message) {
    return message.startsWith('#TM') || message.startsWith('#TX');
  }
  ```

### `parse(message)`

Parses the message into structured data.

- **Parameters**: `message` (string) - Raw message text
- **Returns**: `Object` - Parsed message object with structure:
  ```javascript
  {
    type: 'MESSAGE_TYPE',        // Message type identifier
    raw: 'original message',      // Original raw message
    parsed: { /* data */ },       // Your parsed data
    timestamp: 1234567890         // Unix timestamp
  }
  ```

## Optional Functions

### `init()`

Called once when parser is created. Use for initialization tasks.

```javascript
init() {
  // Load lookup tables, compile regex, etc.
  this.clearanceCodes = loadClearanceCodes();
}
```

### `validate(parsed)`

Validates the parsed message. Return `false` to reject message.

```javascript
validate(parsed) {
  return parsed && parsed.callsign && parsed.altitude > 0;
}
```

### `getMetadata()`

Returns parser metadata (already implemented in base parser).

## Helper Functions

The base parser provides helper functions:

### `startsWithAny(message, prefixes)`

Check if message starts with any of the given prefixes.

```javascript
const { startsWithAny } = require('../src/parser/base-parser');

if (startsWithAny(message, ['#TM', '#TX', '#TZ'])) {
  // Handle text messages
}
```

### `splitMessage(message, delimiter)`

Split message by delimiter (default: ':').

```javascript
const { splitMessage } = require('../src/parser/base-parser');

const fields = splitMessage(message); // Uses ':' delimiter
const parts = splitMessage(message, '|'); // Custom delimiter
```

### `parseIntField(value, defaultValue)`

Parse integer with default fallback.

```javascript
const { parseIntField } = require('../src/parser/base-parser');

const altitude = parseIntField(fields[3], 0); // Returns 0 if invalid
```

### `parseFloatField(value, defaultValue)`

Parse float with default fallback.

```javascript
const { parseFloatField } = require('../src/parser/base-parser');

const latitude = parseFloatField(fields[4], 0.0);
```

## Advanced Patterns

### Lookup Tables

For complex parsing with code lookups:

```javascript
function createClearanceParser(config = {}) {
  const base = createBaseParser({ name: 'clearance', ...config });

  // Load lookup tables
  const clearanceTypes = {
    'IFR': 'IFR Clearance',
    'VFR': 'VFR Clearance',
    'SVFR': 'Special VFR Clearance',
    'PDC': 'Pre-Departure Clearance'
  };

  const facilityTypes = {
    'TWR': 'Tower',
    'APP': 'Approach',
    'CTR': 'Center',
    'GND': 'Ground'
  };

  return {
    ...base,

    canHandle(message) {
      return message.startsWith('#TM');
    },

    parse(message) {
      const parts = message.split(':');
      const messageText = parts[2];

      // Extract clearance code
      const codeMatch = messageText.match(/CLR:(\w+)/);
      const code = codeMatch ? codeMatch[1] : null;

      return {
        type: 'CLEARANCE',
        raw: message,
        parsed: {
          from: parts[0].substring(3),
          to: parts[1],
          clearanceType: clearanceTypes[code] || code,
          message: messageText
        },
        timestamp: Date.now()
      };
    }
  };
}
```

### Multi-Step Parsing

For complex messages requiring multiple passes:

```javascript
function createComplexParser(config = {}) {
  const base = createBaseParser({ name: 'complex', ...config });

  function parseStep1(message) {
    // First pass: basic structure
    return splitMessage(message);
  }

  function parseStep2(fields) {
    // Second pass: extract specific fields
    return {
      header: fields[0],
      body: fields.slice(1).join(':')
    };
  }

  function parseStep3(data) {
    // Third pass: enrich with lookups
    return {
      ...data,
      enriched: lookupCode(data.header)
    };
  }

  return {
    ...base,

    canHandle(message) {
      return message.startsWith('COMPLEX:');
    },

    parse(message) {
      const step1 = parseStep1(message);
      const step2 = parseStep2(step1);
      const step3 = parseStep3(step2);

      return {
        type: 'COMPLEX',
        raw: message,
        parsed: step3,
        timestamp: Date.now()
      };
    }
  };
}
```

### Regular Expression Parsing

For pattern-based parsing:

```javascript
function createRegexParser(config = {}) {
  const base = createBaseParser({ name: 'regex', ...config });

  const patterns = {
    position: /POS:([A-Z0-9]+):(-?\d+\.\d+):(-?\d+\.\d+):(\d+)/,
    clearance: /CLR:([A-Z0-9]+):([A-Z]+):(.+)/
  };

  return {
    ...base,

    canHandle(message) {
      return Object.values(patterns).some(p => p.test(message));
    },

    parse(message) {
      // Try position pattern
      let match = message.match(patterns.position);
      if (match) {
        return {
          type: 'POSITION',
          raw: message,
          parsed: {
            callsign: match[1],
            latitude: parseFloat(match[2]),
            longitude: parseFloat(match[3]),
            altitude: parseInt(match[4])
          },
          timestamp: Date.now()
        };
      }

      // Try clearance pattern
      match = message.match(patterns.clearance);
      if (match) {
        return {
          type: 'CLEARANCE',
          raw: message,
          parsed: {
            callsign: match[1],
            type: match[2],
            details: match[3]
          },
          timestamp: Date.now()
        };
      }

      return null;
    }
  };
}
```

## Configuration

Parsers can receive configuration from `config/config.json`:

```json
{
  "parsers": {
    "my-parser": {
      "enabled": true,
      "option1": "value1",
      "lookupTable": "./data/lookup.json"
    }
  }
}
```

Access configuration in parser:

```javascript
function createMyParser(config = {}) {
  const base = createBaseParser({ name: 'my-parser', ...config });

  const option1 = config.option1 || 'default';
  const lookupData = loadJsonFile(config.lookupTable);

  return {
    ...base,
    // ... parser implementation
  };
}
```

## Testing Your Parser

Create a test file to verify parser behavior:

```javascript
// test-my-parser.js
const createMyParser = require('./parsers/my-parser');

const parser = createMyParser();

const testMessages = [
  'MY_PREFIX:DATA1:DATA2',
  'MY_PREFIX:OTHER:FORMAT'
];

testMessages.forEach(msg => {
  if (parser.canHandle(msg)) {
    const result = parser.parse(msg);
    console.log('Parsed:', JSON.stringify(result, null, 2));
  }
});
```

Run with: `node test-my-parser.js`

## Loading External Data

For lookup tables and reference data:

```javascript
const { readFileSync } = require('fs');
const { join } = require('path');

function loadLookupTable(filename) {
  try {
    const path = join(__dirname, '../data', filename);
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading ${filename}:`, err.message);
    return {};
  }
}
```

## Best Practices

1. **Keep parsers focused**: One parser per protocol or message category
2. **Validate input**: Check message format before parsing
3. **Handle errors**: Return `null` for invalid messages, don't throw
4. **Use helpers**: Leverage base parser helper functions
5. **Document codes**: Include lookup tables for clearance codes, etc.
6. **Test thoroughly**: Test with real message samples
7. **Performance**: Avoid complex operations in `canHandle()`
8. **Immutability**: Don't modify the original message

## Troubleshooting

### Parser not loading

- Check filename ends with `.js`
- Verify parser exports a function
- Check for syntax errors: `node parsers/my-parser.js`

### Parser not receiving messages

- Verify `canHandle()` returns `true` for test messages
- Check port configuration in `config/config.json`
- Enable debug logging

### Parsed data not saving to database

- Ensure `parse()` returns correct structure
- Check `parsed` field is not `null`
- Verify database connection

## Examples

See `example-parser.js` for a complete working example.

For the FSD protocol parser (built-in), see: `src/parser/parsers/fsd-parser.js`

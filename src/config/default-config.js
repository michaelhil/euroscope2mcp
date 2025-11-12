/**
 * default-config.js
 * Default configuration for euroscope2mcp
 */

function getDefaultConfig() {
  return {
    capture: {
      interface: 'Ethernet',
      tsharkPath: 'C:\\Program Files\\Wireshark\\tshark.exe',
      ports: [
        {
          port: 6809,
          parser: 'fsd',
          enabled: true,
          label: 'VATSIM FSD'
        }
      ]
    },

    parsers: {
      fsd: {
        // FSD-specific configuration
        enabled: true
      },
      raw: {
        // Raw pass-through parser
        enabled: true
      }
    },

    outputs: {
      web: {
        enabled: true,
        port: 3000,
        host: '0.0.0.0'
      },
      database: {
        enabled: false,
        host: 'localhost',
        port: 5432,
        database: 'euroscope',
        user: 'euroscope',
        password: process.env.DB_PASSWORD || '',
        batchSize: 100,
        flushInterval: 1000
      },
      file: {
        enabled: false,
        path: './logs/capture.log'
      }
    },

    logging: {
      level: 'info',
      file: './logs/app.log'
    }
  };
}

module.exports = { getDefaultConfig };

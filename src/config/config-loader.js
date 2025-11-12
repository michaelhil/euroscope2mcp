/**
 * config-loader.js
 * Load and merge configuration from multiple sources
 */

const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { getDefaultConfig } = require('./default-config');

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Load JSON config file
 */
function loadJsonConfig(filePath) {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading config from ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Load configuration with priority:
 * 1. Default config
 * 2. config/config.json (user overrides)
 * 3. Environment variables
 */
function loadConfig(configPath) {
  const defaultConfig = getDefaultConfig();

  // Try to load user config
  const userConfigPath = configPath || join(process.cwd(), 'config', 'config.json');
  const userConfig = loadJsonConfig(userConfigPath);

  // Merge configs
  let config = defaultConfig;
  if (userConfig) {
    config = deepMerge(defaultConfig, userConfig);
  }

  // Override with environment variables
  if (process.env.DB_PASSWORD) {
    config.outputs.database.password = process.env.DB_PASSWORD;
  }
  if (process.env.WEB_PORT) {
    config.outputs.web.port = parseInt(process.env.WEB_PORT, 10);
  }
  if (process.env.DB_HOST) {
    config.outputs.database.host = process.env.DB_HOST;
  }

  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];

  if (!config.capture || !config.capture.ports) {
    errors.push('capture.ports is required');
  }

  if (!Array.isArray(config.capture.ports)) {
    errors.push('capture.ports must be an array');
  }

  config.capture.ports.forEach((portConfig, index) => {
    if (!portConfig.port || typeof portConfig.port !== 'number') {
      errors.push(`capture.ports[${index}].port must be a number`);
    }
    if (!portConfig.parser || typeof portConfig.parser !== 'string') {
      errors.push(`capture.ports[${index}].parser must be a string`);
    }
  });

  if (config.outputs.web.enabled) {
    if (!config.outputs.web.port || typeof config.outputs.web.port !== 'number') {
      errors.push('outputs.web.port must be a number');
    }
  }

  return errors;
}

module.exports = {
  loadConfig,
  validateConfig,
  deepMerge
};

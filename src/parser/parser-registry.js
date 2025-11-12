/**
 * parser-registry.js
 * Registry for managing parser plugins
 */

const { readdirSync, existsSync, statSync } = require('fs');
const { join, extname } = require('path');

/**
 * Create a parser registry
 */
function createParserRegistry() {
  const parsers = new Map();
  const instances = new Map();

  /**
   * Register a parser factory function
   */
  function register(name, parserFactory) {
    if (parsers.has(name)) {
      console.warn(`Parser '${name}' already registered, overwriting`);
    }
    parsers.set(name, parserFactory);
  }

  /**
   * Unregister a parser
   */
  function unregister(name) {
    parsers.delete(name);
    instances.delete(name);
  }

  /**
   * Check if parser is registered
   */
  function has(name) {
    return parsers.has(name);
  }

  /**
   * Create parser instance (or return cached instance)
   */
  function create(name, config = {}) {
    if (!parsers.has(name)) {
      throw new Error(`Parser '${name}' not registered`);
    }

    // Return cached instance if exists
    const cacheKey = `${name}:${JSON.stringify(config)}`;
    if (instances.has(cacheKey)) {
      return instances.get(cacheKey);
    }

    // Create new instance
    const factory = parsers.get(name);
    const instance = factory(config);

    // Initialize if needed
    if (typeof instance.init === 'function') {
      instance.init();
    }

    // Cache instance
    instances.set(cacheKey, instance);

    return instance;
  }

  /**
   * Get all registered parser names
   */
  function list() {
    return Array.from(parsers.keys());
  }

  /**
   * Get parser metadata
   */
  function getMetadata(name) {
    if (!parsers.has(name)) {
      return null;
    }

    const instance = create(name);
    return instance.getMetadata ? instance.getMetadata() : { name };
  }

  /**
   * Load parsers from directory
   */
  function loadFromDirectory(dirPath) {
    if (!existsSync(dirPath)) {
      console.warn(`Parser directory not found: ${dirPath}`);
      return;
    }

    const files = readdirSync(dirPath);
    let loaded = 0;

    files.forEach(file => {
      if (extname(file) !== '.js') return;

      try {
        const filePath = join(dirPath, file);
        const stat = statSync(filePath);

        if (!stat.isFile()) return;

        const module = require(filePath);
        const parserName = file.replace('.js', '');

        // Check for factory function
        if (typeof module === 'function') {
          register(parserName, module);
          loaded++;
        } else if (module.createParser && typeof module.createParser === 'function') {
          register(parserName, module.createParser);
          loaded++;
        } else if (module[`create${capitalize(parserName)}Parser`]) {
          const factoryName = `create${capitalize(parserName)}Parser`;
          register(parserName, module[factoryName]);
          loaded++;
        }
      } catch (err) {
        console.error(`Error loading parser from ${file}:`, err.message);
      }
    });

    console.log(`Loaded ${loaded} parser(s) from ${dirPath}`);
  }

  /**
   * Clear all instances (force reload)
   */
  function clearInstances() {
    instances.clear();
  }

  return {
    register,
    unregister,
    has,
    create,
    list,
    getMetadata,
    loadFromDirectory,
    clearInstances
  };
}

/**
 * Helper: Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { createParserRegistry };

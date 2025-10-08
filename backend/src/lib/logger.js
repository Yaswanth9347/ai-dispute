// Simple logger implementation (fallback from pino)
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args),
  trace: (...args) => console.trace('[TRACE]', ...args),
  fatal: (...args) => console.error('[FATAL]', ...args)
};

module.exports = logger;

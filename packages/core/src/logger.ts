// @edenup/core — Logger

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  scope: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
}

const RESET = '\x1b[0m'

/**
 * Structured logger with scoped namespaces and level filtering.
 * Outputs timestamped, colored log lines to stderr (keeps stdout
 * clean for structured output / IPC).
 */
export class Logger {
  private scope: string
  private minLevel: LogLevel

  constructor(scope: string, minLevel: LogLevel = 'debug') {
    this.scope = scope
    this.minLevel = minLevel
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data)
  }

  /**
   * Create a child logger with a nested scope.
   * e.g. logger.child('budget') → scope becomes 'eden:budget'
   */
  child(childScope: string): Logger {
    return new Logger(`${this.scope}:${childScope}`, this.minLevel)
  }

  /**
   * Set the minimum log level. Messages below this level are suppressed.
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return

    const entry: LogEntry = {
      level,
      scope: this.scope,
      message,
      timestamp: new Date(),
      data,
    }

    const color = LOG_LEVEL_COLORS[level]
    const timestamp = entry.timestamp.toISOString()
    const levelTag = level.toUpperCase().padEnd(5)
    const prefix = `${color}${timestamp} [${levelTag}] ${this.scope}${RESET}`

    const line = data
      ? `${prefix} ${message} ${JSON.stringify(data)}`
      : `${prefix} ${message}`

    // Write to stderr to keep stdout available for structured output
    process.stderr.write(line + '\n')
  }
}

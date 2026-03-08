// @edenup/core — Logger

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  level: LogLevel
  scope: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

const isTTY = process.stdout.isTTY ?? false

const c = {
  dim: (s: string) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  blue: (s: string) => (isTTY ? `\x1b[34m${s}\x1b[0m` : s),
  yellow: (s: string) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  cyan: (s: string) => (isTTY ? `\x1b[36m${s}\x1b[0m` : s),
}

function time(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return c.dim(`${h}:${m}:${s}`)
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
}

/**
 * Structured logger with scoped namespaces and level filtering.
 * Simple, human-first logging.
 * Format: HH:MM:SS LEVEL message
 * Color in TTY, plain in pipes.
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

  success(message: string, data?: Record<string, unknown>): void {
    this.log('success', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data)
  }

  child(childScope: string): Logger {
    return new Logger(`${this.scope}:${childScope}`, this.minLevel)
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return

    let levelTag = ''
    switch (level) {
      case 'debug':
        levelTag = c.dim('DBG')
        break
      case 'info':
        levelTag = c.blue('INF')
        break
      case 'success':
        levelTag = c.green('OK ')
        break
      case 'warn':
        levelTag = c.yellow('WRN')
        break
      case 'error':
        levelTag = c.red('ERR')
        break
    }

    const prefix = `${time()} ${levelTag}`
    
    // Add scope nicely if it's not the default 'eden'
    const scopeTag = this.scope !== 'eden' ? c.dim(`[${this.scope}] `) : ''

    const dataStr = data ? ` ${c.dim(JSON.stringify(data))}` : ''
    
    const line = `${prefix} ${scopeTag}${message}${dataStr}`

    if (level === 'error') {
      console.error(line)
    } else {
      console.log(line)
    }
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context
  }

  if (process.env.APP_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`
    const ctx = context ? ` ${JSON.stringify(context)}` : ''
    console.log(`${prefix}: ${message}${ctx}`)
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context)
}

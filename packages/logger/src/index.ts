type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private readonly context: string) {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry = {
      level,
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

export function createLogger(context: string) {
  return new Logger(context);
}

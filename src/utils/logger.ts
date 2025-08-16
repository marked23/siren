type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  stack?: string;
  url: string;
  userAgent: string;
}

class Logger {
  private baseUrl = `http://${window.location.hostname}:3001/api`;
  private logLevel: LogLevel = 'warn'; // Set active log level here

  private async sendLog(entry: LogEntry): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to send log to server:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private createLogEntry(level: LogLevel, message: string, error?: Error): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      stack: error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
  }

  debug(message: string): void {
    if (!this.shouldLog('debug')) return;
    console.debug(message);
    this.sendLog(this.createLogEntry('debug', message));
  }

  info(message: string): void {
    if (!this.shouldLog('info')) return;
    console.info(message);
    this.sendLog(this.createLogEntry('info', message));
  }

  warn(message: string): void {
    if (!this.shouldLog('warn')) return;
    console.warn(message);
    this.sendLog(this.createLogEntry('warn', message));
  }

  error(message: string, error?: Error): void {
    if (!this.shouldLog('error')) return;
    console.error(message, error);
    this.sendLog(this.createLogEntry('error', message, error));
  }

  logEvent(event: string, data?: any): void {
    const message = `Event: ${event}${data ? ` - Data: ${JSON.stringify(data)}` : ''}`;
    this.info(message);
  }

  logUserAction(action: string, target?: string): void {
    const message = `User Action: ${action}${target ? ` on ${target}` : ''}`;
    this.info(message);
  }
}

export const logger = new Logger();
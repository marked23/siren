interface ConsoleLogEntry {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  timestamp: string;
  url: string;
}

class ConsoleInterceptor {
  private baseUrl = `http://${window.location.hostname}:3001/api`;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };
  }

  private async sendConsoleLog(entry: ConsoleLogEntry): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/console-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      this.originalConsole.error('Failed to send console log to server:', error);
    }
  }

  private createConsoleEntry(type: ConsoleLogEntry['type'], args: any[]): ConsoleLogEntry {
    return {
      type,
      args: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return arg;
      }),
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
  }

  private wrapConsoleMethod(type: ConsoleLogEntry['type']) {
    const original = this.originalConsole[type];
    return (...args: any[]) => {
      original.apply(console, args);
      this.sendConsoleLog(this.createConsoleEntry(type, args));
    };
  }

  init(): void {
    console.log = this.wrapConsoleMethod('log');
    console.warn = this.wrapConsoleMethod('warn');
    console.error = this.wrapConsoleMethod('error');
    console.info = this.wrapConsoleMethod('info');
    console.debug = this.wrapConsoleMethod('debug');

    // Also capture unhandled errors and promise rejections
    window.addEventListener('error', (event) => {
      this.sendConsoleLog(this.createConsoleEntry('error', [
        `Unhandled Error: ${event.message}`,
        `File: ${event.filename}:${event.lineno}:${event.colno}`,
        event.error?.stack || 'No stack trace available'
      ]));
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.sendConsoleLog(this.createConsoleEntry('error', [
        'Unhandled Promise Rejection:',
        event.reason
      ]));
    });
  }

  restore(): void {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }
}

export const consoleInterceptor = new ConsoleInterceptor();
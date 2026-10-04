export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

type LogLevel = "INFO" | "WARN" | "ERROR";

type LogSink = (line: string) => void;

export class JsonLogger implements Logger {
  constructor(
    private readonly sink: LogSink = (line) => {
      console.log(line);
    },
  ) {}

  info(message: string, context: LogContext = {}): void {
    this.write("INFO", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.write("WARN", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.write("ERROR", message, context);
  }

  private write(level: LogLevel, message: string, context: LogContext): void {
    this.sink(JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...context }));
  }
}

export function describeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorMessage: String(error) };
}

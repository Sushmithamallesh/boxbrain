import { randomUUID } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

let requestId: string | undefined;

export const logger = {
  setRequestId: (id: string) => {
    requestId = id;
  },
  
  getRequestId: () => {
    if (!requestId) {
      requestId = randomUUID();
    }
    return requestId;
  },

  debug: (message: string, metadata?: Record<string, any>) => log('debug', message, metadata),
  info: (message: string, metadata?: Record<string, any>) => log('info', message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => log('warn', message, metadata),
  error: (message: string, metadata?: Record<string, any>) => log('error', message, metadata),
};

function log(level: LogLevel, message: string, metadata?: Record<string, any>) {
  const logMessage: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: logger.getRequestId(),
    metadata: {
      ...metadata,
      environment: process.env.NODE_ENV
    }
  };

  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(logMessage, null, 2));
  } else {
    console.log(JSON.stringify(logMessage));
  }
} 
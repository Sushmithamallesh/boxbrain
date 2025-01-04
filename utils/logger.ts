let requestId: string | null = null;

const logger = {
  getRequestId: () => {
    if (!requestId) {
      requestId = Math.random().toString(36).substring(7);
    }
    return requestId;
  },

  log: (message: string, data?: any) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: logger.getRequestId(),
      level: 'info',
      message,
      ...data
    }));
  },

  debug: (message: string, data?: any) => {
    console.debug(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: logger.getRequestId(),
      level: 'debug',
      message,
      ...data
    }));
  },

  info: (message: string, data?: any) => {
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: logger.getRequestId(),
      level: 'info',
      message,
      ...data
    }));
  },

  warn: (message: string, data?: any) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: logger.getRequestId(),
      level: 'warn',
      message,
      ...data
    }));
  },

  error: (message: string, data?: any) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: logger.getRequestId(),
      level: 'error',
      message,
      ...data
    }));
  }
};

export { logger }; 
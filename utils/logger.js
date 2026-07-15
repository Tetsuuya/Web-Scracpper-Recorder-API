const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels and color mapping
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Custom format for clean console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Format for JSON log files
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, or if we're running locally (not on Render), log to the console with colorized format
if (process.env.NODE_ENV !== 'production' || !process.env.RENDER) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // On Render production, log json to console (best practice for containerized environments)
  logger.add(
    new winston.transports.Console({
      format: fileFormat,
    })
  );
}

module.exports = logger;

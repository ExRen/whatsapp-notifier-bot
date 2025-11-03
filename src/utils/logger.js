const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-notifier-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
          let msg = `[${timestamp}] ${level}: ${message}`;
          if (stack) {
            msg += `\n${stack}`;
          }
          if (Object.keys(metadata).length > 0) {
            msg += `\n${JSON.stringify(metadata, null, 2)}`;
          }
          return msg;
        })
      )
    })
  ]
});

module.exports = logger;
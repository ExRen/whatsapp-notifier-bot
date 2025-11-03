require('dotenv').config();
const express = require('express');
const database = require('./config/database');
const whatsappService = require('./services/baileysService');
const notificationRoutes = require('./routes/notificationRoutes');
const logger = require('./utils/logger');
const schedulerService = require('./services/schedulerService');

class Application {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.server = null;
  }

  setupMiddleware() {
    // Body parser middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/notifications', notificationRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WhatsApp Notifier Bot',
        version: '1.0.0',
        status: 'running',
        whatsappReady: whatsappService.isClientReady(),
        endpoints: {
          health: '/api/notifications/health',
          send: 'POST /api/notifications/send',
          sendBulk: 'POST /api/notifications/send-bulk'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found'
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Express error handler:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`🌐 HTTP Server listening on port ${this.port}`);
        logger.info(`🔗 API URL: http://localhost:${this.port}`);
        resolve();
      }).on('error', (error) => {
        logger.error('❌ Failed to start HTTP server:', error);
        reject(error);
      });
    });
  }

  async initialize() {
    try {
      logger.info('🚀 Starting WhatsApp Notifier Bot...');
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Setup Express
      this.setupMiddleware();
      this.setupRoutes();

      // Start HTTP server
      await this.startServer();

      // Connect to MongoDB
      await database.connect();

      // Initialize WhatsApp service
      await whatsappService.initialize();
      schedulerService.initialize(whatsappService);

      logger.info('✅ All services initialized successfully');
      logger.info('🎉 WhatsApp Notifier Bot is ready!');

    } catch (error) {
      logger.error('❌ Fatal error during initialization:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      await this.shutdown();
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('🛑 Shutting down gracefully...');

    try {
      // Close WhatsApp client
      if (whatsappService) {
        await whatsappService.destroy();
      }

      // Close database connection
      if (database) {
        await database.disconnect();
      }

      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(() => {
            logger.info('✅ HTTP server closed');
            resolve();
          });
        });
      }

      logger.info('✅ Shutdown completed');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
    }
  }
}

// Create and start application
const app = new Application();

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  await app.shutdown();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  app.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  app.shutdown().then(() => process.exit(1));
});

// Start the application
app.initialize();
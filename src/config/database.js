const mongoose = require('mongoose');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables');
      }

      logger.info('🔄 Connecting to MongoDB...');
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(process.env.MONGODB_URI, options);
      
      logger.info('✅ MongoDB connected successfully');
      logger.info(`📊 Database: ${this.connection.connection.name}`);
      logger.info(`🌐 Host: ${this.connection.connection.host}`);

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('✅ MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      logger.error('❌ MongoDB connection failed:', {
        message: error.message,
        code: error.code,
        name: error.name
      });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        logger.info('✅ MongoDB disconnected gracefully');
      }
    } catch (error) {
      logger.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }
}

module.exports = new Database();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.isInitializing = false;
  }

  async initialize() {
    try {
      if (this.isInitializing) {
        logger.warn('⚠️ WhatsApp client is already initializing');
        return;
      }

      this.isInitializing = true;
      logger.info('🔄 Initializing WhatsApp client...');

      // Configure authentication strategy
      const authStrategy = this.getAuthStrategy();

      // Create client with configuration
      this.client = new Client({
        authStrategy: authStrategy,
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',  // Sudah ada
            '--no-zygote',       // Sudah ada
            '--disable-web-security',  // Tambahkan ini
            '--disable-features=IsolateOrigins,site-per-process'  // Tambahkan ini
          ],
          // Let puppeteer use its bundled Chromium
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        },
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize the client
      await this.client.initialize();

      logger.info('✅ WhatsApp client initialization started');
      return this.client;

    } catch (error) {
      this.isInitializing = false;
      logger.error('❌ Failed to initialize WhatsApp client:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  getAuthStrategy() {
    try {
      // Use LocalAuth for simplicity
      return new LocalAuth({
        clientId: process.env.SESSION_NAME || 'whatsapp-session',
        dataPath: './.wwebjs_auth'
      });
    } catch (error) {
      logger.error('❌ Error setting up auth strategy:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // QR Code event
    this.client.on('qr', (qr) => {
      logger.info('📱 QR Code received. Please scan with your phone:');
      qrcode.generate(qr, { small: true });
      logger.info('⏳ Waiting for QR code scan...');
    });

    // Loading screen event
    this.client.on('loading_screen', (percent, message) => {
      logger.info(`⏳ Loading: ${percent}% - ${message}`);
    });

    // Authenticated event
    this.client.on('authenticated', () => {
      logger.info('✅ WhatsApp authenticated successfully');
    });

    // Authentication failure event
    this.client.on('auth_failure', (msg) => {
      logger.error('❌ Authentication failure:', msg);
      this.isInitializing = false;
    });

    // Ready event
    this.client.on('ready', () => {
      this.isReady = true;
      this.isInitializing = false;
      logger.info('✅ WhatsApp client is ready!');
      
      if (this.client.info) {
        logger.info(`📱 Connected as: ${this.client.info.pushname || 'Unknown'}`);
        logger.info(`📞 Phone number: ${this.client.info.wid?.user || 'Unknown'}`);
      }
    });

    // Message event
    this.client.on('message', async (msg) => {
      logger.debug(`📩 Message received from ${msg.from}: ${msg.body}`);
    });

    // Disconnected event
    this.client.on('disconnected', (reason) => {
      logger.warn('⚠️ WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.isInitializing = false;
    });

    // Error event
    this.client.on('error', (error) => {
      logger.error('❌ WhatsApp client error:', {
        message: error.message,
        stack: error.stack
      });
      this.isInitializing = false;
    });
  }

  async sendMessage(phoneNumber, message) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      // Format phone number (remove special characters and add country code if needed)
      const formattedNumber = phoneNumber.replace(/[^\d]/g, '');
      const chatId = `${formattedNumber}@c.us`;

      logger.info(`📤 Sending message to ${chatId}`);
      
      const result = await this.client.sendMessage(chatId, message);
      
      logger.info(`✅ Message sent successfully to ${chatId}`);
      return result;

    } catch (error) {
      logger.error('❌ Failed to send message:', {
        phoneNumber,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async destroy() {
    try {
      if (this.client && this.client.pupBrowser) {
        await this.client.destroy();
        this.isReady = false;
        this.isInitializing = false;
        logger.info('✅ WhatsApp client destroyed');
      } else {
        logger.info('ℹ️ WhatsApp client was not fully initialized, skipping destroy');
      }
    } catch (error) {
      logger.error('❌ Error destroying WhatsApp client:', error);
      // Don't throw error during shutdown
    }
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady;
  }
}

module.exports = new WhatsAppService();
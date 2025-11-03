const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const pino = require('pino');

class BaileysService {
  constructor() {
    this.sock = null;
    this.isReady = false;
    this.isInitializing = false;
    this.authState = null;
  }

  async initialize() {
    try {
      if (this.isInitializing) {
        logger.warn('⚠️ WhatsApp client is already initializing');
        return;
      }

      this.isInitializing = true;
      logger.info('🔄 Initializing WhatsApp client with Baileys...');

      // Load auth state from file
      const { state, saveCreds } = await useMultiFileAuthState('./.wwebjs_auth');
      this.authState = state;

      // Create socket
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // silent, fatal, error, warn, info, debug, trace
        browser: ['WhatsApp Notifier Bot', 'Chrome', '1.0.0']
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Connection update
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code or Pairing Code
        if (qr) {
          // For server deployment, use pairing code
          if (process.env.PAIRING_NUMBER) {
            try {
              const code = await this.sock.requestPairingCode(process.env.PAIRING_NUMBER);
              logger.info(`📱 PAIRING CODE: ${code}`);
              logger.info('⏳ Enter this code in WhatsApp > Linked Devices > Link a Device');
            } catch (err) {
              logger.error('Error requesting pairing code:', err);
            }
          } else {
            // Local development - show QR
            logger.info('📱 QR Code received. Please scan with your phone:');
            qrcode.generate(qr, { small: true });
            logger.info('⏳ Waiting for QR code scan...');
          }
        }

        // Connected
        if (connection === 'open') {
          this.isReady = true;
          this.isInitializing = false;
          logger.info('✅ WhatsApp client is ready!');
          
          const user = this.sock.user;
          if (user) {
            logger.info(`📱 Connected as: ${user.name || 'Unknown'}`);
            logger.info(`📞 Phone number: ${user.id.split(':')[0] || 'Unknown'}`);
          }
        }

        // Disconnected
        if (connection === 'close') {
          this.isReady = false;
          this.isInitializing = false;
          
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.warn(`⚠️ Connection closed. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            logger.info('🔄 Reconnecting...');
            setTimeout(() => this.initialize(), 5000);
          } else {
            logger.error('❌ Logged out. Please delete .wwebjs_auth and restart.');
          }
        }
      });

      // Messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const msg of messages) {
            try {
              if (!msg.key.fromMe && msg.message) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                const jid = msg.key.remoteJid;
                const isGroup = jid.endsWith('@g.us');
                
                logger.debug(`📩 Message from ${jid}${isGroup ? ' (GROUP)' : ''}: ${text}`);
                
                // Handle commands
                if (text) {
                  await this.handleCommand(msg, text);
                }
              }
            } catch (error) {
              logger.error('Error processing message:', error);
            }
          }
        }
      });

      logger.info('✅ WhatsApp client initialization started');
      return this.sock;

    } catch (error) {
      this.isInitializing = false;
      logger.error('❌ Failed to initialize WhatsApp client:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      // Format phone number
      const formattedNumber = phoneNumber.replace(/[^\d]/g, '');
      const jid = `${formattedNumber}@s.whatsapp.net`;

      logger.info(`📤 Sending message to ${jid}`);
      
      await this.sock.sendMessage(jid, { text: message });
      
      logger.info(`✅ Message sent successfully to ${jid}`);

    } catch (error) {
      logger.error('❌ Failed to send message:', {
        phoneNumber,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async sendGroupMessage(groupJid, message, mentionAll = false) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      let mentions = [];

      if (mentionAll) {
        // Get group metadata
        const groupMetadata = await this.sock.groupMetadata(groupJid);
        mentions = groupMetadata.participants.map(p => p.id);
        
        logger.info(`📤 Sending message to group ${groupJid} with ${mentions.length} mentions`);
      }

      // Send with ghost mentions (mentions array without @ in text)
      await this.sock.sendMessage(groupJid, { 
        text: message,
        mentions: mentions // Ini yang bikin invisible mention
      });
      
      logger.info(`✅ Message sent to group successfully`);

    } catch (error) {
      logger.error('❌ Failed to send group message:', error);
      throw error;
    }
  }

  async handleCommand(msg, text) {
    try {
      const command = text.trim().toLowerCase();
      const jid = msg.key.remoteJid;
      const isGroup = jid.endsWith('@g.us');
      
      // Check if owner (add your number)
      const senderNumber = jid.split('@')[0];
      const isOwner = process.env.OWNER_NUMBER && 
                      senderNumber === process.env.OWNER_NUMBER.replace(/^\+/, '');

      if (command === '!ping') {
        await this.sock.sendMessage(jid, { 
          text: '🏓 Pong!\n⏰ ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        });
        logger.info('Command handled: !ping');
      } 
      else if (command === '!help') {
        const helpText = `📋 *WhatsApp Notifier Bot*\n\n` +
          `Available commands:\n` +
          `!ping - Check bot status\n` +
          `!help - Show this help message\n` +
          `!info - Show bot information\n` +
          `!groupid - Get this group ID\n` +
          `!notify - Mention all members (ghost mention)\n` +
          `!test <message> - Test notification\n\n` +
          (isOwner ? `*Admin Commands:*\n` +
          `!schedule - Show schedule config\n` +
          `!setmsg <message> - Set notification message\n` +
          `!settime <cron> - Set schedule (cron format)\n` +
          `!setgroup - Set this group as target\n\n` +
          `*Cron Examples:*\n` +
          `0 20 * * 0 = Minggu 20:00\n` +
          `0 9 * * 1 = Senin 09:00\n` +
          `0 14 * * 5 = Jumat 14:00` : '');
        
        await this.sock.sendMessage(jid, { text: helpText });
        logger.info('Command handled: !help');
      }
      else if (command === '!info') {
        const infoText = `ℹ️ *Bot Information*\n\n` +
          `Name: WhatsApp Notifier Bot\n` +
          `Version: 1.0.0\n` +
          `Status: Active\n` +
          `Library: Baileys`;
        
        await this.sock.sendMessage(jid, { text: infoText });
        logger.info('Command handled: !info');
      }
      else if (command === '!groupid' && isGroup) {
        await this.sock.sendMessage(jid, { 
          text: `📋 *Group ID*\n\n\`${jid}\`\n\nCopy this ID for scheduler config.` 
        });
        logger.info('Command handled: !groupid');
      }
      else if (command === '!notify' && isGroup) {
        const message = `🔔 *Notification*\n\nHello everyone! This is a test notification.`;
        await this.sendGroupMessage(jid, message, true);
        logger.info('Command handled: !notify');
      }
      else if (command.startsWith('!test ') && isGroup) {
        const customMessage = text.substring(6).trim();
        if (customMessage) {
          await this.sendGroupMessage(jid, customMessage, true);
          logger.info('Command handled: !test with custom message');
        }
      }
      // Admin commands
      else if (command === '!schedule' && isOwner) {
        const schedulerService = require('./schedulerService');
        const config = schedulerService.getConfig();
        const scheduleText = `📅 *Schedule Configuration*\n\n` +
          `Enabled: ${config.enabled ? '✅' : '❌'}\n` +
          `Schedule: ${config.schedule}\n` +
          `Target Group: ${config.groupJid}\n` +
          `Message:\n${config.message}`;
        
        await this.sock.sendMessage(jid, { text: scheduleText });
        logger.info('Command handled: !schedule');
      }
      else if (command.startsWith('!setmsg ') && isOwner) {
        const newMessage = text.substring(8).trim();
        if (newMessage) {
          const schedulerService = require('./schedulerService');
          const config = schedulerService.getConfig();
          schedulerService.updateSchedule(config.schedule, newMessage, config.groupJid);
          
          await this.sock.sendMessage(jid, { 
            text: `✅ Message updated:\n\n${newMessage}` 
          });
          logger.info('Command handled: !setmsg');
        }
      }
      else if (command.startsWith('!settime ') && isOwner) {
        const cronExpr = text.substring(9).trim();
        if (cronExpr) {
          const schedulerService = require('./schedulerService');
          const config = schedulerService.getConfig();
          schedulerService.updateSchedule(cronExpr, config.message, config.groupJid);
          
          await this.sock.sendMessage(jid, { 
            text: `✅ Schedule updated: ${cronExpr}` 
          });
          logger.info('Command handled: !settime');
        }
      }
      else if (command === '!setgroup' && isOwner && isGroup) {
        const schedulerService = require('./schedulerService');
        const config = schedulerService.getConfig();
        schedulerService.updateSchedule(config.schedule, config.message, jid);
        
        await this.sock.sendMessage(jid, { 
          text: `✅ This group set as target:\n${jid}` 
        });
        logger.info('Command handled: !setgroup');
      }
    } catch (error) {
      logger.error('Error handling command:', error);
    }
  }

  async destroy() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.isReady = false;
        this.isInitializing = false;
        logger.info('✅ WhatsApp client destroyed');
      } else {
        logger.info('ℹ️ WhatsApp client was not initialized');
      }
    } catch (error) {
      logger.error('❌ Error destroying WhatsApp client:', error);
    }
  }

  getClient() {
    return this.sock;
  }

  isClientReady() {
    return this.isReady;
  }
}

module.exports = new BaileysService();
import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { MongoStore } from 'wwebjs-mongo';
import { MongoClient } from 'mongodb';
import config from '../config.js';
import logger from '../utils/logger.js';

let client = null;
let isReady = false;
let mongoStore = null;

/**
 * Inisialisasi MongoDB Store untuk RemoteAuth
 */
async function initMongoStore() {
  try {
    const mongoClient = new MongoClient(config.MONGODB_URI);
    await mongoClient.connect();
    logger.info('✅ MongoDB connected for RemoteAuth');
    
    mongoStore = new MongoStore({ 
      mongoose: mongoClient.db(config.MONGO_DB_NAME) 
    });
    
    return mongoStore;
  } catch (error) {
    logger.error({ error }, '❌ MongoDB connection failed');
    throw error;
  }
}

/**
 * Inisialisasi WhatsApp Client dengan RemoteAuth
 */
export async function initializeClient() {
  if (client) {
    logger.warn('Client sudah diinisialisasi');
    return client;
  }

  const store = await initMongoStore();

  const puppeteerOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  };

  if (config.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = config.PUPPETEER_EXECUTABLE_PATH;
  }

  client = new Client({
    authStrategy: new RemoteAuth({
      store,
      backupSyncIntervalMs: 300000, // 5 menit
      clientId: 'wa-notifier-bot',
    }),
    puppeteer: puppeteerOptions,
  });

  // Event: QR Code
  client.on('qr', (qr) => {
    logger.info('📱 Scan QR Code berikut untuk login:');
    qrcode.generate(qr, { small: true });
  });

  // Event: Remote session saved
  client.on('remote_session_saved', () => {
    logger.info('💾 Sesi disimpan ke MongoDB');
  });

  // Event: Ready
  client.on('ready', () => {
    isReady = true;
    logger.info('✅ WhatsApp Client siap!');
    logger.info(`📞 Nomor bot: ${client.info.wid.user}`);
  });

  // Event: Auth failure
  client.on('auth_failure', (msg) => {
    logger.error({ msg }, '❌ Autentikasi gagal');
  });

  // Event: Disconnected
  client.on('disconnected', (reason) => {
    isReady = false;
    logger.warn({ reason }, '⚠️ Client terputus');
    // Auto-reinit setelah 10 detik
    setTimeout(() => {
      logger.info('🔄 Mencoba reconnect...');
      client.initialize();
    }, 10000);
  });

  // Event: Message (untuk perintah admin)
  client.on('message', async (msg) => {
    await handleAdminCommands(msg);
  });

  // Initialize
  await client.initialize();
  logger.info('🚀 WhatsApp Client diinisialisasi...');

  return client;
}

/**
 * Get client instance
 */
export function getClient() {
  if (!client) {
    throw new Error('Client belum diinisialisasi. Panggil initializeClient() terlebih dahulu.');
  }
  return client;
}

/**
 * Check apakah client ready
 */
export function isClientReady() {
  return isReady;
}

/**
 * Handle perintah admin
 */
async function handleAdminCommands(msg) {
  const { body, from, author } = msg;
  
  // Cek apakah dari owner
  const senderNumber = String((author || from)).split('@')[0].split(':')[0].replace(/^\+/, '');
if (senderNumber !== String(config.OWNER_NUMBER).replace(/^\+/, '')) return;


  const command = body.trim().toLowerCase();

  try {
    if (command === '!ping') {
      const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      await msg.reply(`🏓 Pong!\n⏰ ${timestamp}`);
      logger.info('Admin command: !ping');
    } else if (command === '!preview') {
      const { fillMessageTemplate } = await import('../utils/cronTime.js');
      const previewText = fillMessageTemplate(config.MESSAGE_TEXT);
      await msg.reply(`📝 Preview pesan:\n\n${previewText}\n\n📌 Mode: ${config.MENTION_MODE}`);
      logger.info('Admin command: !preview');
    } else if (command.startsWith('!setmsg ')) {
      const newMsg = body.substring(8).trim();
      if (newMsg) {
        config.MESSAGE_TEXT = newMsg;
        await msg.reply(`✅ Pesan berhasil diubah:\n${newMsg}`);
        logger.info({ newMsg }, 'Admin command: !setmsg');
      }
    } else if (command.startsWith('!setmode ')) {
      const mode = body.substring(9).trim();
      if (mode === 'visible' || mode === 'dm') {
        config.MENTION_MODE = mode;
        await msg.reply(`✅ Mode diubah ke: ${mode}`);
        logger.info({ mode }, 'Admin command: !setmode');
      } else {
        await msg.reply('❌ Mode tidak valid. Gunakan: visible atau dm');
      }
    } else if (command === '!who') {
      const { getParticipants } = await import('./participants.js');
      const { resolveTargetGroup } = await import('./groupResolver.js');
      
      const targetChat = await resolveTargetGroup(client);
      if (targetChat) {
        const participants = await getParticipants(targetChat);
        await msg.reply(`👥 Total peserta: ${participants.length}\n📊 Max per batch: 50`);
        logger.info('Admin command: !who');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error handling admin command');
  }
}
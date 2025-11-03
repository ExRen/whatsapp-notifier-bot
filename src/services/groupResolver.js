import { MongoClient } from 'mongodb';
import config from '../config.js';
import logger from '../utils/logger.js';

let cachedGroupId = null;
let mongoClient = null;

/**
 * Inisialisasi MongoDB client untuk cache
 */
async function getMongoClient() {
  if (!mongoClient) {
    mongoClient = new MongoClient(config.MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient;
}

/**
 * Simpan GROUP_ID ke MongoDB
 */
async function saveGroupIdToCache(groupId) {
  try {
    const client = await getMongoClient();
    const db = client.db(config.MONGO_DB_NAME);
    const collection = db.collection('bot_meta');
    
    await collection.updateOne(
      { key: 'target_group_id' },
      { $set: { value: groupId, updatedAt: new Date() } },
      { upsert: true }
    );
    
    logger.info({ groupId }, '💾 GROUP_ID disimpan ke cache');
  } catch (error) {
    logger.error({ error }, 'Gagal menyimpan GROUP_ID ke cache');
  }
}

/**
 * Ambil GROUP_ID dari MongoDB cache
 */
async function getGroupIdFromCache() {
  try {
    const client = await getMongoClient();
    const db = client.db(config.MONGO_DB_NAME);
    const collection = db.collection('bot_meta');
    
    const doc = await collection.findOne({ key: 'target_group_id' });
    return doc?.value || null;
  } catch (error) {
    logger.error({ error }, 'Gagal mengambil GROUP_ID dari cache');
    return null;
  }
}

/**
 * Resolve target group dari GROUP_ID atau GROUP_NAME
 */
export async function resolveTargetGroup(client) {
  // 1. Jika sudah ada di memory cache
  if (cachedGroupId) {
    const chat = await client.getChatById(cachedGroupId);
    if (chat && chat.isGroup) {
      return chat;
    }
  }

  // 2. Jika GROUP_ID langsung disediakan
  if (config.GROUP_ID) {
    try {
      const chat = await client.getChatById(config.GROUP_ID);
      if (chat && chat.isGroup) {
        cachedGroupId = config.GROUP_ID;
        await saveGroupIdToCache(config.GROUP_ID);
        logger.info({ groupId: config.GROUP_ID }, '✅ Grup ditemukan via GROUP_ID');
        return chat;
      }
    } catch (error) {
      logger.error({ error }, '❌ GROUP_ID tidak valid');
    }
  }

  // 3. Cari dari MongoDB cache
  const cachedId = await getGroupIdFromCache();
  if (cachedId) {
    try {
      const chat = await client.getChatById(cachedId);
      if (chat && chat.isGroup) {
        cachedGroupId = cachedId;
        logger.info({ groupId: cachedId }, '✅ Grup ditemukan dari cache MongoDB');
        return chat;
      }
    } catch (error) {
      logger.warn('Cache GROUP_ID tidak valid, mencari ulang...');
    }
  }

  // 4. Cari berdasarkan GROUP_NAME
  if (config.GROUP_NAME) {
    const chats = await client.getChats();
    const targetChat = chats.find(
      chat => chat.isGroup && chat.name === config.GROUP_NAME
    );

    if (targetChat) {
      cachedGroupId = targetChat.id._serialized;
      await saveGroupIdToCache(cachedGroupId);
      logger.info({ groupName: config.GROUP_NAME, groupId: cachedGroupId }, '✅ Grup ditemukan via GROUP_NAME');
      return targetChat;
    }
  }

  logger.error('❌ Grup target tidak ditemukan!');
  return null;
}

/**
 * Get cached group ID
 */
export function getCachedGroupId() {
  return cachedGroupId;
}
import logger from '../utils/logger.js';

const participantsCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

/**
 * Ambil daftar participants dari grup dengan cache
 */
export async function getParticipants(chat, forceRefresh = false) {
  const chatId = chat.id._serialized;
  
  // Cek cache
  if (!forceRefresh && participantsCache.has(chatId)) {
    const cached = participantsCache.get(chatId);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('📦 Menggunakan participants dari cache');
      return cached.data;
    }
  }

  // Ambil fresh data
  try {
    const participants = chat.participants || [];
    
    // Filter: hapus bot sendiri dan non-user
    const client = chat.client || global.waClient;
    const botNumber = client.info.wid._serialized;
    
    const filtered = participants
      .map(p => p.id._serialized)
      .filter(jid => jid !== botNumber && jid.endsWith('@c.us'));

    // Simpan ke cache
    participantsCache.set(chatId, {
      data: filtered,
      timestamp: Date.now(),
    });

    logger.info({ count: filtered.length }, '👥 Participants berhasil diambil');
    return filtered;
  } catch (error) {
    logger.error({ error }, '❌ Gagal mengambil participants');
    return [];
  }
}

/**
 * Clear cache participants
 */
export function clearParticipantsCache() {
  participantsCache.clear();
  logger.info('🗑️ Participants cache dibersihkan');
}
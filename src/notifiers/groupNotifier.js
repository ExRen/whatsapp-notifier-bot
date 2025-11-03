import { chunkMentions, buildMentionText } from '../utils/chunk.js';
import { getParticipants } from '../services/participants.js';
import logger from '../utils/logger.js';

/**
 * Kirim notifikasi ke grup dengan visible mentions
 */
export async function notifyGroup(chat, messageText) {
  try {
    const participants = await getParticipants(chat);
    
    if (participants.length === 0) {
      logger.warn('⚠️ Tidak ada participants untuk di-mention');
      return;
    }

    // Pecah mentions jadi beberapa chunk
    const chunks = chunkMentions(participants, 50);
    
    logger.info({ totalChunks: chunks.length, totalParticipants: participants.length }, 
      '📤 Mengirim notifikasi grup...');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const mentionText = buildMentionText(chunk);
      
      const fullMessage = chunks.length > 1
        ? `${messageText}\n\n👥 Batch ${i + 1}/${chunks.length}:\n${mentionText}`
        : `${messageText}\n\n${mentionText}`;

      await chat.sendMessage(fullMessage, {
        mentions: chunk,
      });

      logger.info({ batch: i + 1, count: chunk.length }, '✅ Batch terkirim');

      // Delay antar batch
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info('✅ Notifikasi grup selesai');
  } catch (error) {
    logger.error({ error }, '❌ Gagal mengirim notifikasi grup');
    throw error;
  }
}
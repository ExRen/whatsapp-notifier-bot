import PQueue from 'p-queue';
import { getParticipants } from '../services/participants.js';
import logger from '../utils/logger.js';

/**
 * Kirim DM ke semua participants dengan rate limiting
 */
export async function notifyDM(chat, messageText) {
  try {
    const participants = await getParticipants(chat);
    
    if (participants.length === 0) {
      logger.warn('⚠️ Tidak ada participants untuk DM');
      return;
    }

    // Setup queue dengan rate limit (1 pesan / 400ms)
    const queue = new PQueue({
      interval: 400,
      intervalCap: 1,
      concurrency: 1,
    });

    logger.info({ totalParticipants: participants.length }, '📤 Mengirim DM ke semua participants...');

    let successCount = 0;
    let failCount = 0;

    const tasks = participants.map(jid => 
      queue.add(async () => {
        try {
          const contact = await chat.client.getContactById(jid);
          await contact.sendMessage(messageText);
          successCount++;
          logger.debug({ jid }, '✅ DM terkirim');
        } catch (error) {
          failCount++;
          logger.warn({ jid, error: error.message }, '⚠️ Gagal kirim DM');
        }
      })
    );

    await Promise.all(tasks);

    // Kirim konfirmasi ke grup (tanpa mention)
    await chat.sendMessage(
      `✅ Pengingat telah dikirim via DM ke ${successCount} anggota.\n` +
      (failCount > 0 ? `⚠️ ${failCount} gagal terkirim.` : '')
    );

    logger.info({ success: successCount, failed: failCount }, '✅ Notifikasi DM selesai');
  } catch (error) {
    logger.error({ error }, '❌ Gagal mengirim notifikasi DM');
    throw error;
  }
}
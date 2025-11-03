import cron from 'node-cron';
import config from './config.js';
import logger from './utils/logger.js';
import { fillMessageTemplate } from './utils/cronTime.js';
import { resolveTargetGroup } from './services/groupResolver.js';
import { notifyGroup } from './notifiers/groupNotifier.js';
import { notifyDM } from './notifiers/dmNotifier.js';
import { isClientReady, getClient } from './services/waClient.js';

let scheduledTask = null;

/**
 * Jalankan notifikasi sesuai mode
 */
async function runNotification() {
  try {
    if (!isClientReady()) {
      logger.warn('⚠️ Client belum ready, skip notifikasi');
      return;
    }

    const client = getClient();
    const targetChat = await resolveTargetGroup(client);

    if (!targetChat) {
      logger.error('❌ Grup target tidak ditemukan, skip notifikasi');
      return;
    }

    const messageText = fillMessageTemplate(config.MESSAGE_TEXT);
    
    logger.info({ mode: config.MENTION_MODE }, '🔔 Menjalankan notifikasi terjadwal...');

    if (config.MENTION_MODE === 'visible') {
      await notifyGroup(targetChat, messageText);
    } else if (config.MENTION_MODE === 'dm') {
      await notifyDM(targetChat, messageText);
    }

    logger.info('✅ Notifikasi terjadwal selesai');
  } catch (error) {
    logger.error({ error }, '❌ Error saat menjalankan notifikasi');
  }
}

/**
 * Start scheduler
 */
export function startScheduler() {
  if (scheduledTask) {
    logger.warn('⚠️ Scheduler sudah berjalan');
    return;
  }

  const isValidCron = cron.validate(config.CRON_EXPRESSION);
  if (!isValidCron) {
    logger.error({ cron: config.CRON_EXPRESSION }, '❌ CRON_EXPRESSION tidak valid');
    return;
  }

  scheduledTask = cron.schedule(
    config.CRON_EXPRESSION,
    runNotification,
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  );

  logger.info({ cron: config.CRON_EXPRESSION }, '⏰ Scheduler dimulai');
}

/**
 * Stop scheduler
 */
export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('⏹️ Scheduler dihentikan');
  }
}
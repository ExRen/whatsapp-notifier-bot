const cron = require('node-cron');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.tasks = new Map();
    this.config = {
      groupJid: process.env.TARGET_GROUP_JID || '',
      message: process.env.NOTIFICATION_MESSAGE || '🔔 *Pengingat Mingguan*\n\nHello everyone!',
      schedule: process.env.CRON_SCHEDULE || '0 9 * * 1', // Default: Senin jam 9 pagi
      enabled: process.env.SCHEDULER_ENABLED === 'true'
    };
  }

  initialize(whatsappService) {
    this.whatsappService = whatsappService;

    if (this.config.enabled && this.config.groupJid) {
      this.startWeeklyNotification();
      logger.info('📅 Scheduler initialized');
      logger.info(`⏰ Schedule: ${this.config.schedule}`);
      logger.info(`📝 Message: ${this.config.message.substring(0, 50)}...`);
    } else {
      logger.warn('⚠️ Scheduler disabled or no group JID configured');
    }
  }

  startWeeklyNotification() {
    const taskName = 'weekly-notification';
    
    // Stop existing task if any
    if (this.tasks.has(taskName)) {
      this.tasks.get(taskName).stop();
    }

    // Create new cron task
    const task = cron.schedule(this.config.schedule, async () => {
      try {
        if (!this.whatsappService.isClientReady()) {
          logger.warn('⚠️ WhatsApp client not ready, skipping notification');
          return;
        }

        logger.info('🔔 Sending scheduled notification...');
        await this.whatsappService.sendGroupMessage(
          this.config.groupJid,
          this.config.message,
          true // mention all
        );
        logger.info('✅ Scheduled notification sent');
      } catch (error) {
        logger.error('❌ Error sending scheduled notification:', error);
      }
    });

    this.tasks.set(taskName, task);
    logger.info(`✅ Weekly notification scheduled: ${taskName}`);
  }

  updateSchedule(cronExpression, message, groupJid) {
    this.config.schedule = cronExpression;
    this.config.message = message;
    this.config.groupJid = groupJid;

    // Restart task with new config
    this.startWeeklyNotification();
    logger.info('✅ Schedule updated');
  }

  getConfig() {
    return { ...this.config };
  }

  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();
    logger.info('🛑 Scheduler stopped');
  }
}

module.exports = new SchedulerService();
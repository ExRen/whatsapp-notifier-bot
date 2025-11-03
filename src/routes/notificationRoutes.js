const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

// Health check endpoint
router.get('/health', (req, res) => {
  const isReady = whatsappService.isClientReady();
  res.json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString()
  });
});

// Send notification endpoint
router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    // Validation
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    if (!whatsappService.isClientReady()) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp client is not ready. Please try again later.'
      });
    }

    // Send message
    await whatsappService.sendMessage(phoneNumber, message);

    logger.info(`✅ Notification sent via API to ${phoneNumber}`);

    res.json({
      success: true,
      message: 'Notification sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error in send notification endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send bulk notifications endpoint
router.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, message } = req.body;

    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!whatsappService.isClientReady()) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp client is not ready. Please try again later.'
      });
    }

    // Send messages
    const results = [];
    for (const phoneNumber of recipients) {
      try {
        await whatsappService.sendMessage(phoneNumber, message);
        results.push({ phoneNumber, status: 'success' });
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ phoneNumber, status: 'failed', error: error.message });
      }
    }

    logger.info(`✅ Bulk notification completed. Sent to ${results.filter(r => r.status === 'success').length}/${recipients.length} recipients`);

    res.json({
      success: true,
      message: 'Bulk notification completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error in send bulk notification endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
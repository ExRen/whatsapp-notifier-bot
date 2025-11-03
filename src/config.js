import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const configSchema = z.object({
  TZ: z.string().default('Asia/Jakarta'),
  GROUP_ID: z.string().optional(),
  GROUP_NAME: z.string().optional(),
  CRON_EXPRESSION: z.string().default('0 8 * * 1-5'),
  MENTION_MODE: z.enum(['visible', 'dm']).default('visible'),
  MESSAGE_TEXT: z.string().default('[PENGINGAT] Standup hari ini {{date}}.'),
  OWNER_NUMBER: z.string(),
  ALLOW_ONLY_TARGET_GROUP: z.string().transform(val => val === 'true').default('true'),
  MONGODB_URI: z.string().url(),
  MONGO_DB_NAME: z.string().default('wa_sessions'),
  SESSION_COLLECTION: z.string().default('wwebjs'),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.string().transform(Number).default('3000'),
});

let config;

try {
  config = configSchema.parse(process.env);
  
  // Validasi: minimal GROUP_ID atau GROUP_NAME harus ada
  if (!config.GROUP_ID && !config.GROUP_NAME) {
    throw new Error('Minimal GROUP_ID atau GROUP_NAME harus diisi!');
  }
} catch (error) {
  console.error('❌ Konfigurasi ENV tidak valid:');
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error(error.message);
  }
  process.exit(1);
}

export default config;
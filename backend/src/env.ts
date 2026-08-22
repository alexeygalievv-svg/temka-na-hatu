import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

/** Базовый URL проекта без /rest/v1 — иначе Supabase SDK ломает пути. */
function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  supabaseUrl: normalizeSupabaseUrl(required('SUPABASE_URL')),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  botUsername: process.env.BOT_USERNAME ?? 'your_bot',
  /** Разрешает заголовок `Authorization: dev` для локальной разработки вне Telegram. */
  allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
  storageBucket: process.env.STORAGE_BUCKET ?? 'memories',
  /** Публичный URL backend (для webhook), например https://temka-backend.onrender.com */
  publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL?.replace(/\/$/, ''),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
};

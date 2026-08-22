import { env } from './env.js';

const API_BASE = `https://api.telegram.org/bot${env.telegramBotToken}`;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function mapStartParam(mapId: string): string {
  return `map_${mapId}`;
}

/** Ссылка для шаринга — открывает чат с ботом и вызывает /start map_<id>. */
export function mapShareLink(mapId: string): string {
  return `https://t.me/${env.botUsername}?start=${mapStartParam(mapId)}`;
}

/** Прямое открытие Mini App на карте. */
export function mapOpenLink(mapId: string): string {
  return `https://t.me/${env.botUsername}?startapp=${mapStartParam(mapId)}`;
}

/** Открытие конструктора в Mini App. */
export function builderOpenLink(): string {
  return `https://t.me/${env.botUsername}?startapp=create`;
}

async function callTelegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API ${method} failed`);
  }
  return data.result as T;
}

export async function sendMessage(
  chatId: number,
  text: string,
  extra?: { reply_markup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> } },
): Promise<void> {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

export async function setWebhook(url: string, secretToken?: string): Promise<void> {
  await callTelegram('setWebhook', {
    url,
    allowed_updates: ['message'],
    ...(secretToken ? { secret_token: secretToken } : {}),
  });
}

import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { supabase } from '../supabase.js';
import {
  builderOpenLink,
  escapeHtml,
  mapOpenLink,
  mapShareLink,
  sendMessage,
} from '../telegramBot.js';

interface TelegramUser {
  id: number;
  first_name?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  from?: TelegramUser;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function handleStart(chatId: number, payload: string | undefined): Promise<void> {
  if (payload?.startsWith('map_')) {
    const mapId = payload.slice(4);
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, title, author_name')
      .eq('id', mapId)
      .maybeSingle();

    if (error || !map) {
      await sendMessage(chatId, 'Карта не найдена или ссылка устарела.');
      return;
    }

    const title = escapeHtml(map.title?.trim() || 'Карта воспоминаний');
    const author = map.author_name?.trim();
    const intro = author
      ? `Вам подарили карту воспоминаний «${title}» от ${escapeHtml(author)}.`
      : `Вам подарили карту воспоминаний «${title}».`;

    await sendMessage(chatId, `${intro}\n\nНажмите кнопку ниже, чтобы открыть карту.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть карту', url: mapOpenLink(map.id) }],
          [{ text: 'Поделиться ссылкой', url: mapShareLink(map.id) }],
        ],
      },
    });
    return;
  }

  await sendMessage(
    chatId,
    'Соберите карту ваших мест с фото и историями — и отправьте её близкому человеку.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Создать карту', url: builderOpenLink() }]],
      },
    },
  );
}

export async function telegramRoutes(app: FastifyInstance) {
  app.post('/api/telegram/webhook', async (request, reply) => {
    if (env.telegramWebhookSecret) {
      const token = request.headers['x-telegram-bot-api-secret-token'];
      if (token !== env.telegramWebhookSecret) {
        return reply.code(401).send({ error: 'Invalid webhook secret' });
      }
    }

    const update = request.body as TelegramUpdate;
    const message = update.message;
    if (!message?.text || !message.chat?.id) {
      return reply.send({ ok: true });
    }

    const text = message.text.trim();
    if (!text.startsWith('/start')) {
      return reply.send({ ok: true });
    }

    const payload = text.split(/\s+/).slice(1).join(' ') || undefined;
    try {
      await handleStart(message.chat.id, payload);
    } catch (error) {
      app.log.error(error, 'Telegram /start handler failed');
    }

    return reply.send({ ok: true });
  });
}

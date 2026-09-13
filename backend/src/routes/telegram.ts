import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { supabase } from '../supabase.js';
import {
  builderOpenLink,
  escapeHtml,
  legalPageUrl,
  mapBotStartLink,
  mapOpenLink,
  mapShareLink,
  sendMessage,
} from '../telegramBot.js';

const SUPPORT_EMAIL = 'forsomeonespecial@mail.ru';

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

function docsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Создать карту', url: builderOpenLink() }],
      [{ text: 'Пользовательское соглашение', url: legalPageUrl('#legal-terms') }],
      [{ text: 'Политика конфиденциальности', url: legalPageUrl('#legal-privacy') }],
      [{ text: 'Цены и тарифы', url: legalPageUrl('#legal-prices') }],
      [{ text: 'Поддержка', url: legalPageUrl('#legal-contacts') }],
    ],
  };
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
          [{ text: 'Открыть через бота', url: mapBotStartLink(map.id) }],
        ],
      },
    });
    return;
  }

  await sendMessage(
    chatId,
    'Соберите карту ваших мест с фото и историями — и отправьте её близкому человеку.\n\nПубликация одной карты — 149 ₽.\nПоддержка: ' +
      SUPPORT_EMAIL,
    { reply_markup: docsKeyboard() },
  );
}

async function handleDocsCommand(chatId: number, command: string): Promise<void> {
  if (command === '/terms') {
    await sendMessage(chatId, 'Пользовательское соглашение сервиса «Карта воспоминаний»:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть соглашение', url: legalPageUrl('#legal-terms') }]],
      },
    });
    return;
  }
  if (command === '/privacy') {
    await sendMessage(chatId, 'Политика конфиденциальности сервиса «Карта воспоминаний»:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть политику', url: legalPageUrl('#legal-privacy') }]],
      },
    });
    return;
  }
  if (command === '/prices') {
    await sendMessage(
      chatId,
      'Публикация одной карты воспоминаний — 149 ₽. Цена окончательная, доплат нет.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Открыть цены и тарифы', url: legalPageUrl('#legal-prices') }]],
        },
      },
    );
    return;
  }
  if (command === '/support') {
    await sendMessage(
      chatId,
      `Служба поддержки: ${SUPPORT_EMAIL}\nПо вопросам услуги, оплаты и возврата пишите на эту почту.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Контакты поддержки', url: legalPageUrl('#legal-contacts') }]],
        },
      },
    );
  }
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
    const command = text.split(/\s+/)[0]?.split('@')[0]?.toLowerCase() ?? '';

    try {
      if (command === '/start') {
        const payload = text.split(/\s+/).slice(1).join(' ') || undefined;
        await handleStart(message.chat.id, payload);
      } else if (
        command === '/terms' ||
        command === '/privacy' ||
        command === '/prices' ||
        command === '/support'
      ) {
        await handleDocsCommand(message.chat.id, command);
      }
    } catch (error) {
      app.log.error(error, 'Telegram command handler failed');
    }

    return reply.send({ ok: true });
  });
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './env.js';
import { validateInitData, type TelegramUser } from './telegramAuth.js';

const DEV_USER: TelegramUser = { id: 1, first_name: 'Dev' };

export function authenticate(request: FastifyRequest): TelegramUser | null {
  const header = request.headers.authorization;
  if (!header) return null;
  if (env.allowDevAuth && header === 'dev') return DEV_USER;
  const [scheme, ...rest] = header.split(' ');
  if (scheme !== 'tma') return null;
  return validateInitData(rest.join(' '), env.telegramBotToken);
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<TelegramUser | null> {
  const user = authenticate(request);
  if (!user) {
    await reply.code(401).send({ error: 'Invalid or missing Telegram init data' });
    return null;
  }
  return user;
}

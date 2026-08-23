import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { mapRoutes } from './routes/maps.js';
import { telegramRoutes } from './routes/telegram.js';
import { supabase } from './supabase.js';
import { setWebhook } from './telegramBot.js';

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 16 * 1024 * 1024, files: 1 },
});

app.get('/api/health', async () => {
  const { error } = await supabase.from('maps').select('id').limit(1);
  return {
    ok: !error,
    db: error ? error.message : 'ok',
  };
});

await app.register(mapRoutes);
await app.register(telegramRoutes);

app.setErrorHandler((error: FastifyError, _request, reply) => {
  app.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  const message = error.message || 'Internal server error';
  reply.code(status).send({ error: message });
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
  if (env.publicWebhookUrl) {
    const webhookUrl = `${env.publicWebhookUrl}/api/telegram/webhook`;
    try {
      await setWebhook(webhookUrl, env.telegramWebhookSecret);
      app.log.info(`Telegram webhook set: ${webhookUrl}`);
    } catch (error) {
      app.log.error(error, 'Failed to set Telegram webhook');
    }
  }
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

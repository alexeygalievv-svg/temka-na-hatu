import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { mapRoutes } from './routes/maps.js';
import { supabase } from './supabase.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

app.get('/', async () => ({
  ok: true,
  service: 'memory-map-api',
  health: '/api/health',
}));

app.get('/api/health', async () => {
  const { error } = await supabase.from('maps').select('id').limit(1);
  return {
    ok: !error,
    db: error ? error.message : 'ok',
  };
});

await app.register(mapRoutes);

app.setErrorHandler((error: FastifyError, _request, reply) => {
  app.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  const message = error.message || 'Internal server error';
  reply.code(status).send({ error: message });
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

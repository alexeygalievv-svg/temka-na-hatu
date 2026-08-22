import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { mapRoutes } from './routes/maps.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

app.get('/api/health', async () => ({ ok: true }));

await app.register(mapRoutes);

app.setErrorHandler((error: FastifyError, _request, reply) => {
  app.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  reply.code(status).send({ error: status === 500 ? 'Internal server error' : error.message });
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { customAlphabet } from 'nanoid';
import { env } from '../env.js';
import { supabase } from '../supabase.js';
import { validateInitData, type TelegramUser } from '../telegramAuth.js';

/** Только буквы и цифры — безопасно для параметра startapp. */
const generateMapId = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 12);

const DEV_USER: TelegramUser = { id: 1, first_name: 'Dev' };

function authenticate(request: FastifyRequest): TelegramUser | null {
  const header = request.headers.authorization;
  if (!header) return null;
  if (env.allowDevAuth && header === 'dev') return DEV_USER;
  const [scheme, ...rest] = header.split(' ');
  if (scheme !== 'tma') return null;
  return validateInitData(rest.join(' '), env.telegramBotToken);
}

async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<TelegramUser | null> {
  const user = authenticate(request);
  if (!user) {
    await reply.code(401).send({ error: 'Invalid or missing Telegram init data' });
    return null;
  }
  return user;
}

async function requireOwnedMap(mapId: string, user: TelegramUser, reply: FastifyReply) {
  const { data: map, error } = await supabase
    .from('maps')
    .select('id, owner_tg_id')
    .eq('id', mapId)
    .maybeSingle();
  if (error) throw error;
  if (!map) {
    await reply.code(404).send({ error: 'Map not found' });
    return null;
  }
  if (Number(map.owner_tg_id) !== user.id) {
    await reply.code(403).send({ error: 'Not the owner of this map' });
    return null;
  }
  return map;
}

interface CreateMapBody {
  title?: string;
  authorName?: string;
  introEyebrow?: string;
  introMessage?: string;
  introButton?: string;
}

interface CreatePointBody {
  title: string;
  description?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  orderIndex: number;
}

export async function mapRoutes(app: FastifyInstance) {
  // Создание карты
  app.post('/api/maps', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const body = (request.body ?? {}) as CreateMapBody;
    const id = generateMapId();
    const authorName =
      body.authorName?.trim() ||
      [user.first_name, user.last_name].filter(Boolean).join(' ');

    const { error } = await supabase.from('maps').insert({
      id,
      owner_tg_id: user.id,
      author_name: authorName,
      title: body.title?.trim() || 'Карта воспоминаний',
      intro_eyebrow: body.introEyebrow?.trim() || 'Для тебя собрал',
      intro_message: body.introMessage?.trim() || null,
      intro_button: body.introButton?.trim() || 'Открыть карту',
    });
    if (error) throw error;

    return reply.code(201).send({
      id,
      link: `https://t.me/${env.botUsername}?startapp=map_${id}`,
    });
  });

  // Добавление точки
  app.post('/api/maps/:id/points', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id: mapId } = request.params as { id: string };
    if (!(await requireOwnedMap(mapId, user, reply))) return;

    const body = request.body as CreatePointBody;
    if (
      !body ||
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      typeof body.lat !== 'number' ||
      typeof body.lng !== 'number'
    ) {
      return reply.code(400).send({ error: 'title, lat and lng are required' });
    }

    const { data: point, error } = await supabase
      .from('points')
      .insert({
        map_id: mapId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        photo_url: body.photoUrl || null,
        lat: body.lat,
        lng: body.lng,
        order_index: body.orderIndex ?? 0,
      })
      .select('id')
      .single();
    if (error) throw error;

    return reply.code(201).send({ id: point.id });
  });

  // Загрузка фото
  app.post('/api/maps/:id/photos', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id: mapId } = request.params as { id: string };
    if (!(await requireOwnedMap(mapId, user, reply))) return;

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: 'File is required' });
    }
    if (!file.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only images are allowed' });
    }

    const buffer = await file.toBuffer();
    const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${mapId}/${generateMapId()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(env.storageBucket)
      .upload(path, buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(env.storageBucket).getPublicUrl(path);
    return reply.code(201).send({ url: data.publicUrl });
  });

  // Получение карты с точками (публичный доступ для получателя)
  app.get('/api/maps/:id', async (request, reply) => {
    const { id: mapId } = request.params as { id: string };

    const { data: map, error: mapError } = await supabase
      .from('maps')
      .select('id, title, author_name, intro_eyebrow, intro_message, intro_button, created_at')
      .eq('id', mapId)
      .maybeSingle();
    if (mapError) throw mapError;
    if (!map) return reply.code(404).send({ error: 'Map not found' });

    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('id, title, description, photo_url, lat, lng, order_index')
      .eq('map_id', mapId)
      .order('order_index', { ascending: true });
    if (pointsError) throw pointsError;

    return {
      id: map.id,
      title: map.title,
      authorName: map.author_name,
      intro: {
        eyebrow: map.intro_eyebrow ?? 'Для тебя собрал',
        message: map.intro_message ?? '',
        buttonText: map.intro_button ?? 'Открыть карту',
      },
      points: (points ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description ?? '',
        photoUrl: p.photo_url ?? null,
        lat: p.lat,
        lng: p.lng,
        orderIndex: p.order_index,
      })),
    };
  });
}

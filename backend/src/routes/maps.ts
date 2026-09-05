import type { FastifyInstance, FastifyReply } from 'fastify';
import { customAlphabet } from 'nanoid';
import type { PostgrestError } from '@supabase/supabase-js';
import { env } from '../env.js';
import { requireUser } from '../httpAuth.js';
import { supabase } from '../supabase.js';
import { mapShareLink } from '../telegramBot.js';

/** Только буквы и цифры — безопасно для параметра startapp. */
const generateMapId = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 12);

function isMissingIntroColumns(error: PostgrestError): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('intro_');
}

function isMissingIntroPhoto(error: PostgrestError): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('intro_photo');
}

function isMissingHappenedOn(error: PostgrestError): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('happened_on');
}

function normalizeHappenedOn(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function serializePoint(p: {
  id: string;
  title: string;
  description?: string | null;
  photo_url?: string | null;
  happened_on?: string | null;
  lat: number;
  lng: number;
  order_index: number;
}) {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? '',
    photoUrl: p.photo_url ?? null,
    happenedOn: p.happened_on ?? null,
    lat: p.lat,
    lng: p.lng,
    orderIndex: p.order_index,
  };
}

async function fetchPoints(mapId: string) {
  const withDate = await supabase
    .from('points')
    .select('id, title, description, photo_url, happened_on, lat, lng, order_index')
    .eq('map_id', mapId)
    .order('order_index', { ascending: true });
  if (withDate.error && isMissingHappenedOn(withDate.error)) {
    const fallback = await supabase
      .from('points')
      .select('id, title, description, photo_url, lat, lng, order_index')
      .eq('map_id', mapId)
      .order('order_index', { ascending: true });
    if (fallback.error) throwDbError(fallback.error, 'Не удалось загрузить точки');
    return (fallback.data ?? []).map((p) => serializePoint({ ...p, happened_on: null }));
  }
  if (withDate.error) throwDbError(withDate.error, 'Не удалось загрузить точки');
  return (withDate.data ?? []).map(serializePoint);
}

function throwDbError(error: PostgrestError, context: string): never {
  const err = new Error(`${context}: ${error.message}`) as Error & { statusCode?: number };
  err.statusCode = 500;
  throw err;
}

async function requireOwnedMap(mapId: string, user: { id: number }, reply: FastifyReply) {
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
  introPhotoDataUrl?: string;
}

async function storeIntroPhotoFromDataUrl(mapId: string, raw?: string): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) return null;
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${mapId}/${generateMapId()}.${ext}`;
  const { error } = await supabase.storage
    .from(env.storageBucket)
    .upload(path, buffer, { contentType: mime });
  if (error) return null;
  return supabase.storage.from(env.storageBucket).getPublicUrl(path).data.publicUrl;
}

interface UpdateMapBody {
  introPhotoUrl?: string | null;
}

interface CreatePointBody {
  title: string;
  description?: string;
  photoUrl?: string;
  happenedOn?: string | null;
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

    const introPhotoUrl = await storeIntroPhotoFromDataUrl(id, body.introPhotoDataUrl);

    const { error } = await supabase.from('maps').insert({
      id,
      owner_tg_id: user.id,
      author_name: authorName,
      title: body.title?.trim() || 'Карта воспоминаний',
      intro_eyebrow: body.introEyebrow?.trim() || 'Для тебя собрал',
      intro_message: body.introMessage?.trim() || null,
      intro_button: body.introButton?.trim() || 'Открыть карту',
      intro_photo_url: introPhotoUrl,
      status: 'draft',
    });

    if (error) {
      if (isMissingIntroPhoto(error)) {
        const { error: noPhotoError } = await supabase.from('maps').insert({
          id,
          owner_tg_id: user.id,
          author_name: authorName,
          title: body.title?.trim() || 'Карта воспоминаний',
          intro_eyebrow: body.introEyebrow?.trim() || 'Для тебя собрал',
          intro_message: body.introMessage?.trim() || null,
          intro_button: body.introButton?.trim() || 'Открыть карту',
          status: 'draft',
        });
        if (noPhotoError) {
          if (isMissingIntroColumns(noPhotoError)) {
            const { error: fallbackError } = await supabase.from('maps').insert({
              id,
              owner_tg_id: user.id,
              author_name: authorName,
              title: body.title?.trim() || 'Карта воспоминаний',
              status: 'draft',
            });
            if (fallbackError) throwDbError(fallbackError, 'Не удалось создать карту');
          } else {
            throwDbError(noPhotoError, 'Не удалось создать карту');
          }
        }
      } else if (isMissingIntroColumns(error)) {
        const { error: fallbackError } = await supabase.from('maps').insert({
          id,
          owner_tg_id: user.id,
          author_name: authorName,
          title: body.title?.trim() || 'Карта воспоминаний',
          status: 'draft',
        });
        if (fallbackError) throwDbError(fallbackError, 'Не удалось создать карту');
      } else {
        throwDbError(error, 'Не удалось создать карту');
      }
    }

    const link = mapShareLink(id);

    return reply.code(201).send({
      id,
      link,
      status: 'draft',
      introPhotoUrl,
    });
  });

  app.patch('/api/maps/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const { id: mapId } = request.params as { id: string };
    if (!(await requireOwnedMap(mapId, user, reply))) return;

    const body = (request.body ?? {}) as UpdateMapBody;
    if (typeof body.introPhotoUrl !== 'string' || !body.introPhotoUrl.trim()) {
      return reply.code(400).send({ error: 'introPhotoUrl is required' });
    }

    const { error } = await supabase
      .from('maps')
      .update({ intro_photo_url: body.introPhotoUrl.trim() })
      .eq('id', mapId);
    if (error) {
      if (isMissingIntroPhoto(error)) {
        return reply.code(200).send({ ok: true });
      }
      throwDbError(error, 'Не удалось сохранить фото открытия');
    }

    return reply.code(200).send({ ok: true });
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

    const row = {
      map_id: mapId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      photo_url: body.photoUrl || null,
      happened_on: normalizeHappenedOn(body.happenedOn),
      lat: body.lat,
      lng: body.lng,
      order_index: body.orderIndex ?? 0,
    };
    const { data: point, error } = await supabase.from('points').insert(row).select('id').single();
    if (error && isMissingHappenedOn(error)) {
      const { happened_on: _unused, ...legacyRow } = row;
      void _unused;
      const fallback = await supabase.from('points').insert(legacyRow).select('id').single();
      if (fallback.error) throw fallback.error;
      return reply.code(201).send({ id: fallback.data.id });
    }
    if (error || !point) throw error ?? new Error('Не удалось сохранить место');

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
    const mime = file.mimetype || 'image/jpeg';
    if (!mime.startsWith('image/') && mime !== 'application/octet-stream') {
      return reply.code(400).send({ error: 'Only images are allowed' });
    }

    const buffer = await file.toBuffer();
    const contentType = mime.startsWith('image/') ? mime : 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${mapId}/${generateMapId()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(env.storageBucket)
      .upload(path, buffer, { contentType });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(env.storageBucket).getPublicUrl(path);
    return reply.code(201).send({ url: data.publicUrl });
  });

  // Получение карты с точками (публичный доступ для получателя)
  app.get('/api/maps/:id', async (request, reply) => {
    const { id: mapId } = request.params as { id: string };

    const { data: map, error: mapError } = await supabase
      .from('maps')
      .select('id, title, author_name, intro_eyebrow, intro_message, intro_button, intro_photo_url, created_at, status')
      .eq('id', mapId)
      .maybeSingle();
    if (mapError) {
      if (isMissingIntroPhoto(mapError)) {
        const { data: noPhotoMap, error: noPhotoError } = await supabase
          .from('maps')
          .select('id, title, author_name, intro_eyebrow, intro_message, intro_button, created_at')
          .eq('id', mapId)
          .maybeSingle();
        if (noPhotoError) {
          if (isMissingIntroColumns(noPhotoError)) {
            /* ниже общий fallback */
          } else {
            throwDbError(noPhotoError, 'Не удалось загрузить карту');
          }
        } else if (noPhotoMap) {
          return {
            id: noPhotoMap.id,
            title: noPhotoMap.title,
            authorName: noPhotoMap.author_name,
            intro: {
              eyebrow: noPhotoMap.intro_eyebrow ?? 'Для тебя собрал',
              message: noPhotoMap.intro_message ?? '',
              buttonText: noPhotoMap.intro_button ?? 'Открыть карту',
              photoPreview: null,
              photoFile: null,
            },
            points: await fetchPoints(mapId),
          };
        }
      }
      if (isMissingIntroColumns(mapError) || isMissingIntroPhoto(mapError)) {
        const { data: legacyMap, error: legacyError } = await supabase
          .from('maps')
          .select('id, title, author_name, created_at')
          .eq('id', mapId)
          .maybeSingle();
        if (legacyError) throwDbError(legacyError, 'Не удалось загрузить карту');
        if (!legacyMap) return reply.code(404).send({ error: 'Map not found' });
        return {
          id: legacyMap.id,
          title: legacyMap.title,
          authorName: legacyMap.author_name,
          intro: {
            eyebrow: 'Для тебя собрал',
            message: '',
            buttonText: 'Открыть карту',
            photoPreview: null,
            photoFile: null,
          },
          points: await fetchPoints(mapId),
        };
      }
      throwDbError(mapError, 'Не удалось загрузить карту');
    }
    if (!map) return reply.code(404).send({ error: 'Map not found' });
    if (map.status && map.status !== 'active') {
      return reply.code(404).send({ error: 'Map not found' });
    }

    return {
      id: map.id,
      title: map.title,
      authorName: map.author_name,
      intro: {
        eyebrow: map.intro_eyebrow ?? 'Для тебя собрал',
        message: map.intro_message ?? '',
        buttonText: map.intro_button ?? 'Открыть карту',
        photoPreview: map.intro_photo_url ?? null,
        photoFile: null,
      },
      points: await fetchPoints(mapId),
    };
  });
}

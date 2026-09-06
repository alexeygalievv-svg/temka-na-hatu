import type { FastifyInstance } from 'fastify';
import { customAlphabet } from 'nanoid';
import { env } from '../env.js';
import { requireUser } from '../httpAuth.js';
import { PUBLICATION_DESCRIPTION, PUBLICATION_PRICE_RUB, PUBLICATION_TITLE } from '../pricing.js';
import { supabase } from '../supabase.js';
import { escapeHtml, mapOpenLink, mapShareLink, sendMessage } from '../telegramBot.js';
import {
  createYooKassaPayment,
  fetchYooKassaPayment,
  isYooKassaConfigured,
  type PaymentMethod,
} from '../yookassa.js';

const generatePaymentId = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 12);

function parseMethod(raw: unknown): PaymentMethod {
  return raw === 'sbp' ? 'sbp' : 'bank_card';
}

function appReturnUrl(params: Record<string, string>): string {
  const url = new URL(env.publicAppUrl);
  url.searchParams.set('page', 'pay');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function savePayment(row: {
  id: string;
  yookassaId?: string | null;
  mapId?: string | null;
  ownerTgId?: number | null;
  method: PaymentMethod;
  status: string;
}) {
  const { error } = await supabase.from('payments').upsert({
    id: row.id,
    yookassa_id: row.yookassaId ?? null,
    map_id: row.mapId ?? null,
    owner_tg_id: row.ownerTgId ?? null,
    method: row.method,
    status: row.status,
    amount_rub: PUBLICATION_PRICE_RUB,
  });
  if (error) {
    /* таблица payments может быть ещё не создана — карта всё равно активируется по webhook metadata */
  }
}

export async function activateMap(mapId: string): Promise<{ link: string; title: string; ownerTgId: number } | null> {
  const { data: map, error } = await supabase
    .from('maps')
    .select('id, title, owner_tg_id, status')
    .eq('id', mapId)
    .maybeSingle();
  if (error || !map) return null;

  if (map.status !== 'active') {
    const { error: updateError } = await supabase
      .from('maps')
      .update({ status: 'active', paid_at: new Date().toISOString() })
      .eq('id', mapId);
    if (updateError) throw updateError;
  }

  const link = mapShareLink(map.id);
  const ownerTgId = Number(map.owner_tg_id);
  if (map.status !== 'active') {
    const title = escapeHtml(map.title || 'Карта воспоминаний');
    void sendMessage(ownerTgId, `Карта «${title}» готова!\n\nСсылка для получателя:\n${link}`, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть карту', url: mapOpenLink(map.id) }]],
      },
    }).catch(() => {
      /* пользователь мог ещё не писать боту /start */
    });
  }

  return { link, title: map.title, ownerTgId };
}

async function fulfillYooKassaPayment(yookassaId: string): Promise<{
  status: string;
  paid: boolean;
  mapId: string | null;
  link: string;
}> {
  const payment = await fetchYooKassaPayment(yookassaId);
  const mapId = payment.metadata?.mapId || null;
  const paid = payment.status === 'succeeded' || payment.paid === true;

  await supabase
    .from('payments')
    .update({
      status: paid ? 'succeeded' : payment.status,
      yookassa_id: payment.id,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .or(`yookassa_id.eq.${payment.id},id.eq.${payment.metadata?.orderId ?? 'none'}`);

  let link = '';
  if (paid && mapId) {
    const activated = await activateMap(mapId);
    link = activated?.link ?? mapShareLink(mapId);
  }

  return { status: paid ? 'succeeded' : payment.status, paid, mapId, link };
}

export async function paymentRoutes(app: FastifyInstance) {
  app.get('/api/offer', async () => ({
    title: PUBLICATION_TITLE,
    description: PUBLICATION_DESCRIPTION,
    priceRub: PUBLICATION_PRICE_RUB,
    currency: 'RUB',
    methods: ['sbp', 'bank_card'],
  }));

  app.get('/api/maps/:id/checkout', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { id: mapId } = request.params as { id: string };
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, title, owner_tg_id, status')
      .eq('id', mapId)
      .maybeSingle();
    if (error) throw error;
    if (!map) return reply.code(404).send({ error: 'Map not found' });
    if (Number(map.owner_tg_id) !== user.id) {
      return reply.code(403).send({ error: 'Not the owner of this map' });
    }
    const paid = map.status === 'active';
    return {
      mapId: map.id,
      title: map.title,
      status: map.status,
      paid,
      link: paid ? mapShareLink(map.id) : '',
      priceRub: PUBLICATION_PRICE_RUB,
    };
  });

  app.get('/api/payments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!/^[0-9A-Za-z-]+$/.test(id)) {
      return reply.code(400).send({ error: 'Invalid payment id' });
    }
    const { data: row } = await supabase
      .from('payments')
      .select('id, yookassa_id, map_id, status')
      .or(`id.eq.${id},yookassa_id.eq.${id}`)
      .maybeSingle();

    if (row?.status === 'succeeded' && row.map_id) {
      const activated = await activateMap(row.map_id);
      return {
        id: row.id,
        status: 'succeeded',
        paid: true,
        mapId: row.map_id,
        link: activated?.link ?? mapShareLink(row.map_id),
      };
    }

    const yookassaId = row?.yookassa_id;
    if (yookassaId && isYooKassaConfigured()) {
      try {
        const result = await fulfillYooKassaPayment(yookassaId);
        return { id, ...result };
      } catch {
        /* вернём то, что есть в базе */
      }
    }

    if (!row) return reply.code(404).send({ error: 'Payment not found' });
    return {
      id: row.id,
      status: row.status,
      paid: row.status === 'succeeded',
      mapId: row.map_id,
      link: row.status === 'succeeded' && row.map_id ? mapShareLink(row.map_id) : '',
    };
  });

  app.post('/api/payments', async (request, reply) => {
    const body = (request.body ?? {}) as { method?: string; mapId?: string };
    const method = parseMethod(body.method);
    const mapId = typeof body.mapId === 'string' && body.mapId.trim() ? body.mapId.trim() : null;
    let ownerTgId: number | null = null;

    if (mapId) {
      const user = await requireUser(request, reply);
      if (!user) return;
      ownerTgId = user.id;
      const { data: map, error } = await supabase
        .from('maps')
        .select('id, owner_tg_id, status')
        .eq('id', mapId)
        .maybeSingle();
      if (error) throw error;
      if (!map) return reply.code(404).send({ error: 'Map not found' });
      if (Number(map.owner_tg_id) !== user.id) {
        return reply.code(403).send({ error: 'Not the owner of this map' });
      }
      if (map.status === 'active') {
        return {
          id: mapId,
          paid: true,
          status: 'succeeded',
          confirmationUrl: null,
          link: mapShareLink(mapId),
          priceRub: PUBLICATION_PRICE_RUB,
        };
      }
    }

    const orderId = generatePaymentId();

    if (!isYooKassaConfigured()) {
      if (env.allowDevAuth && mapId) {
        const activated = await activateMap(mapId);
        await savePayment({
          id: orderId,
          mapId,
          ownerTgId,
          method,
          status: 'succeeded',
        });
        return {
          id: orderId,
          paid: true,
          status: 'succeeded',
          confirmationUrl: null,
          link: activated?.link ?? mapShareLink(mapId),
          priceRub: PUBLICATION_PRICE_RUB,
        };
      }
      return reply.code(503).send({
        error: 'Оплата пока не подключена. Добавьте ключи ЮKassa на сервер.',
      });
    }

    const payment = await createYooKassaPayment({
      amountRub: PUBLICATION_PRICE_RUB,
      description: PUBLICATION_TITLE,
      returnUrl: appReturnUrl({
        order: orderId,
        ...(mapId ? { map: mapId } : {}),
      }),
      method,
      metadata: {
        orderId,
        kind: mapId ? 'map' : 'catalog',
        ...(mapId ? { mapId } : {}),
        ...(ownerTgId ? { ownerTgId: String(ownerTgId) } : {}),
      },
      idempotenceKey: orderId,
    });

    await savePayment({
      id: orderId,
      yookassaId: payment.id,
      mapId,
      ownerTgId,
      method,
      status: payment.status === 'succeeded' ? 'succeeded' : 'pending',
    });

    if (payment.status === 'succeeded' && mapId) {
      const activated = await activateMap(mapId);
      return {
        id: orderId,
        paid: true,
        status: 'succeeded',
        confirmationUrl: null,
        link: activated?.link ?? mapShareLink(mapId),
        priceRub: PUBLICATION_PRICE_RUB,
      };
    }

    if (!payment.confirmationUrl) {
      return reply.code(502).send({ error: 'ЮKassa не вернула ссылку на оплату' });
    }

    return {
      id: orderId,
      paid: false,
      status: payment.status,
      confirmationUrl: payment.confirmationUrl,
      yookassaId: payment.id,
      link: '',
      priceRub: PUBLICATION_PRICE_RUB,
    };
  });

  app.post('/api/payments/webhook', async (request, reply) => {
    const payload = (request.body ?? {}) as {
      event?: string;
      object?: { id?: string; status?: string; metadata?: Record<string, string> };
    };
    const yookassaId = payload.object?.id;
    if (!yookassaId) return reply.code(200).send({ ok: true });
    try {
      await fulfillYooKassaPayment(yookassaId);
    } catch (error) {
      request.log.error(error, 'YooKassa webhook failed');
    }
    return reply.code(200).send({ ok: true });
  });
}

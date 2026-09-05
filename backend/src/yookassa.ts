import { env } from './env.js';

const API = 'https://api.yookassa.ru/v3';

export type PaymentMethod = 'sbp' | 'bank_card';

interface YooKassaPayment {
  id: string;
  status: string;
  paid?: boolean;
  confirmation?: { type?: string; confirmation_url?: string };
  metadata?: Record<string, string>;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.yookassaShopId}:${env.yookassaSecretKey}`).toString('base64')}`;
}

export function isYooKassaConfigured(): boolean {
  return Boolean(env.yookassaShopId && env.yookassaSecretKey);
}

export async function createYooKassaPayment(input: {
  amountRub: number;
  description: string;
  returnUrl: string;
  method: PaymentMethod;
  metadata: Record<string, string>;
  idempotenceKey: string;
}): Promise<{ id: string; status: string; confirmationUrl: string | null }> {
  const body = {
    amount: { value: input.amountRub.toFixed(2), currency: 'RUB' },
    capture: true,
    description: input.description.slice(0, 128),
    confirmation: { type: 'redirect', return_url: input.returnUrl },
    payment_method_data: { type: input.method },
    metadata: input.metadata,
  };

  let payment = await postPayment(body, input.idempotenceKey);
  if (!payment.confirmation?.confirmation_url) {
    const { payment_method_data: _unused, ...withoutMethod } = body;
    void _unused;
    payment = await postPayment(withoutMethod, `${input.idempotenceKey}-any`);
  }

  return {
    id: payment.id,
    status: payment.status,
    confirmationUrl: payment.confirmation?.confirmation_url ?? null,
  };
}

async function postPayment(
  body: Record<string, unknown>,
  idempotenceKey: string,
): Promise<YooKassaPayment> {
  const response = await fetch(`${API}/payments`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Idempotence-Key': idempotenceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as YooKassaPayment & {
    description?: string;
    code?: string;
  };
  if (!response.ok || !data.id) {
    throw new Error(data.description || 'Не удалось создать платёж в ЮKassa');
  }
  return data;
}

export async function fetchYooKassaPayment(id: string): Promise<YooKassaPayment> {
  const response = await fetch(`${API}/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: authHeader() },
  });
  const data = (await response.json()) as YooKassaPayment & { description?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.description || 'Не удалось получить платёж в ЮKassa');
  }
  return data;
}

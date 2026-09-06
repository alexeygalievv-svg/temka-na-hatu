import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { LegalLinks } from '../components/LegalLinks';
import {
  createPayment,
  fetchCheckout,
  fetchOffer,
  fetchPayment,
  type PaymentMethod,
} from '../api';
import { PUBLICATION_PRICE_RUB } from '../lib/pricing';
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, payReturnParams } from '../lib/legal';
import { CardIcon, CheckIcon, SbpIcon } from '../components/PayIcons';
import { haptic, openExternalLink } from '../telegram';

function readPendingPay(): { orderId: string | null; mapId: string | null } {
  const fromUrl = payReturnParams();
  if (fromUrl.orderId || fromUrl.mapId) return fromUrl;
  try {
    const raw = sessionStorage.getItem('temka-pending-pay');
    if (!raw) return { orderId: null, mapId: null };
    const data = JSON.parse(raw) as { orderId?: string; mapId?: string | null };
    return { orderId: data.orderId ?? null, mapId: data.mapId ?? null };
  } catch {
    return { orderId: null, mapId: null };
  }
}

interface PayScreenProps {
  mapTitle?: string;
  onBack?: () => void;
  onPaid?: (link: string) => void;
  prepareMap?: () => Promise<{ mapId: string; link: string }>;
}

export function PayScreen({ mapTitle, onBack, onPaid, prepareMap }: PayScreenProps) {
  const returning = readPendingPay();
  const [method, setMethod] = useState<PaymentMethod>('sbp');
  const [accepted, setAccepted] = useState(false);
  const [priceRub, setPriceRub] = useState(PUBLICATION_PRICE_RUB);
  const [pendingId, setPendingId] = useState<string | null>(returning.orderId);
  const [pendingMapId, setPendingMapId] = useState<string | null>(returning.mapId);
  const [busy, setBusy] = useState(Boolean(returning.orderId || returning.mapId));
  const [waiting, setWaiting] = useState(Boolean(returning.orderId || returning.mapId));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const preparedRef = useRef<{ mapId: string; link: string } | null>(null);

  useEffect(() => {
    void fetchOffer()
      .then((offer) => setPriceRub(offer.priceRub))
      .catch(() => {
        /* локальная цена уже стоит */
      });
  }, []);

  useEffect(() => {
    const orderId = pendingId;
    const mapId = pendingMapId;
    if (!orderId && !mapId) return;

    let cancelled = false;
    async function check() {
      try {
        if (orderId) {
          const payment = await fetchPayment(orderId);
          if (cancelled) return;
          if (payment.paid) {
            haptic('medium');
            if (payment.link && onPaid) onPaid(payment.link);
            else setDone(true);
            setWaiting(false);
            setBusy(false);
            return;
          }
        }
        if (mapId) {
          const checkout = await fetchCheckout(mapId);
          if (cancelled) return;
          if (checkout.paid) {
            haptic('medium');
            if (checkout.link && onPaid) onPaid(checkout.link);
            else setDone(true);
            setWaiting(false);
            setBusy(false);
            return;
          }
        }
      } catch {
        /* ещё не успело пройти */
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), 2500);
    const stop = window.setTimeout(() => {
      if (cancelled) return;
      setWaiting(false);
      setBusy(false);
      setError('Оплата ещё не подтверждена. Если вы уже заплатили, подождите немного и обновите страницу.');
    }, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [onPaid, pendingId, pendingMapId]);

  async function pay() {
    if (!accepted || busy) return;
    setError(null);
    setBusy(true);
    try {
      let mapId: string | undefined = preparedRef.current?.mapId;
      if (!mapId && prepareMap) {
        const prepared = await prepareMap();
        preparedRef.current = prepared;
        mapId = prepared.mapId;
      }
      const payment = await createPayment({ method, mapId });
      if (payment.paid) {
        haptic('medium');
        if (payment.link && onPaid) onPaid(payment.link);
        else setDone(true);
        return;
      }
      if (!payment.confirmationUrl) {
        throw new Error('Не удалось открыть оплату');
      }
      setWaiting(true);
      setPendingId(payment.id);
      if (mapId) setPendingMapId(mapId);
      sessionStorage.setItem(
        'temka-pending-pay',
        JSON.stringify({ orderId: payment.id, mapId: mapId ?? null }),
      );
      openExternalLink(payment.confirmationUrl);
    } catch (err) {
      setWaiting(false);
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Не удалось начать оплату');
    }
  }

  return (
    <div className="pay-screen">
      <motion.div
        className="pay-screen__card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <p className="pay-screen__eyebrow">Отправка карты</p>
        <h1 className="pay-screen__title">Почти готово</h1>
        {mapTitle ? (
          <p className="pay-screen__map">«{mapTitle.trim() || 'Карта воспоминаний'}»</p>
        ) : null}
        <p className="pay-screen__lead">
          Чтобы отправить карту близкому человеку, нужно оплатить {priceRub} ₽. После оплаты вы
          получите ссылку.
        </p>
        <p className="pay-screen__price">{priceRub} ₽</p>

        <p className="pay-screen__methods-label">Способ оплаты</p>
        <div className="pay-screen__methods" role="radiogroup" aria-label="Способ оплаты">
          <button
            type="button"
            className={method === 'sbp' ? 'pay-method is-active' : 'pay-method'}
            onClick={() => setMethod('sbp')}
            aria-pressed={method === 'sbp'}
          >
            <span className="pay-method__top">
              <span className="pay-method__icon">
                <SbpIcon />
              </span>
              {method === 'sbp' ? (
                <span className="pay-method__check">
                  <CheckIcon />
                </span>
              ) : null}
            </span>
            <span className="pay-method__label">СБП</span>
          </button>
          <button
            type="button"
            className={method === 'bank_card' ? 'pay-method is-active' : 'pay-method'}
            onClick={() => setMethod('bank_card')}
            aria-pressed={method === 'bank_card'}
          >
            <span className="pay-method__top">
              <span className="pay-method__icon">
                <CardIcon />
              </span>
              {method === 'bank_card' ? (
                <span className="pay-method__check">
                  <CheckIcon />
                </span>
              ) : null}
            </span>
            <span className="pay-method__label">Карты РФ</span>
          </button>
        </div>

        <label className="pay-screen__accept">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            Оплачивая, я принимаю{' '}
            <a href={LEGAL_TERMS_PATH}>условия использования</a>
            {' и '}
            <a href={LEGAL_PRIVACY_PATH}>политику конфиденциальности</a>
          </span>
        </label>

        {waiting ? (
          <p className="pay-screen__waiting">Проверяем оплату… Можно вернуться сюда после платежа.</p>
        ) : null}
        {done ? (
          <p className="pay-screen__waiting">Оплата прошла. Ссылка появится автоматически.</p>
        ) : null}
        {error ? <p className="pay-screen__error">{error}</p> : null}

        <div className="pay-screen__actions">
          {!done && (
            <Button wide disabled={!accepted || busy} onClick={() => void pay()}>
              {busy ? 'Готовим оплату…' : 'Оплатить'}
            </Button>
          )}
          {onBack ? (
            <Button variant="ghost" wide onClick={onBack}>
              Вернуться к карте
            </Button>
          ) : null}
        </div>

        <LegalLinks className="link-screen__legal" />
      </motion.div>
    </div>
  );
}

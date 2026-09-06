import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { LegalLinks } from '../components/LegalLinks';
import { SupportContacts } from '../components/SupportContacts';
import { PUBLICATION_PRICE_RUB, PUBLICATION_DESCRIPTION } from '../lib/pricing';
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../lib/legal';
import { CardIcon, CheckIcon, SbpIcon } from '../components/PayIcons';
import { haptic } from '../telegram';

type PaymentMethod = 'sbp' | 'bank_card';

interface PayScreenProps {
  mapTitle?: string;
  onBack?: () => void;
  onPay?: (method: PaymentMethod) => Promise<void>;
}

export function PayScreen({ mapTitle, onBack, onPay }: PayScreenProps) {
  const [method, setMethod] = useState<PaymentMethod>('sbp');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!accepted || busy || !onPay) return;
    setError(null);
    setBusy(true);
    try {
      await onPay(method);
      haptic('medium');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать карту');
    } finally {
      setBusy(false);
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
        <h1 className="pay-screen__title">Публикация карты</h1>
        {mapTitle ? (
          <p className="pay-screen__map">«{mapTitle.trim() || 'Карта воспоминаний'}»</p>
        ) : null}
        <p className="pay-screen__lead">{PUBLICATION_DESCRIPTION}</p>

        <ul className="pay-screen__includes">
          <li>Интерактивная карта мест с фото и описаниями</li>
          <li>Уникальная ссылка для близкого человека</li>
          <li>Разовая оплата, без подписки</li>
        </ul>

        <p className="pay-screen__price">{PUBLICATION_PRICE_RUB} ₽</p>
        <p className="pay-screen__price-note">Цена окончательная, включая все налоги. Доплат нет.</p>

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
            <a href={LEGAL_TERMS_PATH}>пользовательское соглашение</a>
            {' и '}
            <a href={LEGAL_PRIVACY_PATH}>политику конфиденциальности</a>
          </span>
        </label>

        {error ? <p className="pay-screen__error">{error}</p> : null}

        <div className="pay-screen__actions">
          <Button wide disabled={!accepted || busy} onClick={() => void pay()}>
            {busy ? 'Публикуем…' : `Оплатить ${PUBLICATION_PRICE_RUB} ₽`}
          </Button>
          {onBack ? (
            <Button variant="ghost" wide onClick={onBack}>
              Вернуться к карте
            </Button>
          ) : null}
        </div>

        <SupportContacts />
        <LegalLinks className="link-screen__legal" />
      </motion.div>
    </div>
  );
}

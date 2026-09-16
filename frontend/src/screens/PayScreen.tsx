import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { LegalLinks } from '../components/LegalLinks';
import { SupportContacts } from '../components/SupportContacts';
import { ReviewCode } from '../components/ReviewCode';
import { PUBLICATION_PRICE_RUB, PUBLICATION_DESCRIPTION, PUBLICATION_TITLE } from '../lib/pricing';
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../lib/legal';
import { CardIcon, CheckIcon, SbpIcon } from '../components/PayIcons';
import { haptic } from '../telegram';

type PaymentMethod = 'sbp' | 'bank_card';

interface PayScreenProps {
  mapTitle?: string;
  onBack?: () => void;
}

export function PayScreen({ mapTitle, onBack }: PayScreenProps) {
  const [method, setMethod] = useState<PaymentMethod>('sbp');
  const [accepted, setAccepted] = useState(false);
  const [stub, setStub] = useState(false);

  function pay() {
    haptic('soft');
    setStub(true);
  }

  return (
    <div className="pay-screen">
      {onBack ? (
        <button type="button" className="pay-screen__back" onClick={onBack} aria-label="Назад">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path
              d="M15 5 8 12l7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      <motion.div
        className="pay-screen__card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <p className="pay-screen__eyebrow">Покупка</p>
        <h1 className="pay-screen__title">Оплатить / Купить</h1>
        <p className="pay-screen__map">{PUBLICATION_TITLE}</p>
        {mapTitle ? (
          <p className="pay-screen__lead">Карта «{mapTitle.trim() || 'Карта воспоминаний'}»</p>
        ) : (
          <p className="pay-screen__lead">{PUBLICATION_DESCRIPTION}</p>
        )}

        <p className="pay-screen__methods-label">Тариф</p>
        <ul className="pay-screen__includes">
          <li>Интерактивная карта мест с фото и описаниями</li>
          <li>Уникальная ссылка для близкого человека</li>
          <li>Разовая оплата, без подписки</li>
        </ul>

        <p className="pay-screen__price">{PUBLICATION_PRICE_RUB} ₽</p>
        <p className="pay-screen__price-note">
          Конкретная цена тарифа. Окончательная, включая все налоги. Доплат нет.
        </p>

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

        {stub ? (
          <p className="pay-screen__stub" role="status">
            Оплата пока недоступна. Платёжная система подключается.
          </p>
        ) : null}

        <div className="pay-screen__actions">
          <Button wide onClick={pay}>
            Оплатить / Купить {PUBLICATION_PRICE_RUB} ₽
          </Button>
          {onBack ? (
            <Button variant="ghost" wide onClick={onBack}>
              Вернуться к карте
            </Button>
          ) : null}
        </div>

        <SupportContacts />
        <LegalLinks className="legal-buttons legal-buttons--pay" />
        <ReviewCode />
      </motion.div>
    </div>
  );
}

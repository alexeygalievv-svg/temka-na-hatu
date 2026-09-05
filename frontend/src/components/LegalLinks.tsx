import {
  LEGAL_CONTACTS_PATH,
  LEGAL_DELIVERY_PATH,
  LEGAL_PAY_PATH,
  LEGAL_PRIVACY_PATH,
  LEGAL_REQUISITES_PATH,
  LEGAL_TERMS_PATH,
} from '../lib/legal';

interface LegalLinksProps {
  className?: string;
  /** Полный набор документов для страницы оплаты. */
  documents?: boolean;
  /** Ссылка на страницу оплаты. */
  pay?: boolean;
}

export function LegalLinks({ className, documents = false, pay = false }: LegalLinksProps) {
  return (
    <p className={className}>
      <a href={LEGAL_TERMS_PATH}>Условия и оферта</a>
      <span aria-hidden="true">·</span>
      <a href={LEGAL_REQUISITES_PATH}>Реквизиты</a>
      {documents && (
        <>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_DELIVERY_PATH}>Получение</a>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_PRIVACY_PATH}>Конфиденциальность</a>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_CONTACTS_PATH}>Контакты</a>
        </>
      )}
      {pay && (
        <>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_PAY_PATH}>Оплата 199 ₽</a>
        </>
      )}
    </p>
  );
}

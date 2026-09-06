import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/contacts';

interface SupportContactsProps {
  className?: string;
}

export function SupportContacts({ className }: SupportContactsProps) {
  return (
    <div className={className ?? 'support-contacts'}>
      <p className="support-contacts__label">Служба поддержки</p>
      <a className="support-contacts__email" href={SUPPORT_MAILTO}>
        {SUPPORT_EMAIL}
      </a>
      <p className="support-contacts__hint">Ответим по почте в рабочие дни.</p>
    </div>
  );
}

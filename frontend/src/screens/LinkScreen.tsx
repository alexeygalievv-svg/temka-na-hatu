import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { copyText, haptic, shareLink } from '../telegram';

interface LinkScreenProps {
  link: string;
  title: string;
  onBack: () => void;
}

export function LinkScreen({ link, title, onBack }: LinkScreenProps) {
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    const ok = await copyText(link);
    if (ok) {
      setCopied(true);
      setManualCopy(false);
      haptic('medium');
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    setManualCopy(true);
    haptic('soft');
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      input.setSelectionRange(0, link.length);
    });
  }

  return (
    <div className="link-screen">
      <motion.div
        className="link-screen__card"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <motion.div
          className="link-screen__seal"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 320, damping: 18 }}
        >
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </motion.div>

        <h1 className="link-screen__title">Карта готова</h1>
        <p className="link-screen__subtitle">
          «{title.trim() || 'Карта воспоминаний'}» ждёт своего адресата
        </p>

        <button type="button" className="link-screen__link" onClick={copy}>
          <span>{link.replace('https://', '')}</span>
          <em>
            {copied
              ? 'Скопировано'
              : manualCopy
                ? 'Выделите ссылку и скопируйте'
                : 'Нажмите, чтобы скопировать'}
          </em>
        </button>

        {manualCopy && (
          <input
            ref={inputRef}
            className="link-screen__fallback"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        )}

        <div className="link-screen__actions">
          <Button
            wide
            onClick={() => shareLink(link, `Я собрал для тебя карту наших мест: «${title.trim() || 'Карта воспоминаний'}»`)}
          >
            Отправить в Telegram
          </Button>
          <Button variant="ghost" wide onClick={onBack}>
            Вернуться к карте
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

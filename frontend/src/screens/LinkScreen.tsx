import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { copyText, haptic, shareLink } from '../telegram';

interface LinkScreenProps {
  link: string;
  title: string;
  onBack: () => void;
  onReset: () => void;
}

export function LinkScreen({ link, title, onBack, onReset }: LinkScreenProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectLink() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    input.setSelectionRange(0, link.length);
  }

  async function copy() {
    const ok = await copyText(link, inputRef.current);
    selectLink();
    if (ok) {
      setCopied(true);
      haptic('medium');
      setTimeout(() => setCopied(false), 2200);
      return;
    }
    haptic('soft');
  }

  useEffect(() => {
    requestAnimationFrame(selectLink);
  }, [link]);

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

        <label className="link-screen__link">
          <input
            ref={inputRef}
            className="link-screen__fallback"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.currentTarget.select()}
          />
          <em>{copied ? 'Скопировано' : 'Нажмите «Скопировать» или зажмите ссылку'}</em>
        </label>

        <div className="link-screen__actions">
          <Button wide onClick={() => void copy()}>
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </Button>
          <Button
            wide
            onClick={() =>
              shareLink(
                link,
                `Я собрал для тебя карту наших мест: «${title.trim() || 'Карта воспоминаний'}»`,
              )
            }
          >
            Отправить в Telegram
          </Button>
          <Button variant="ghost" wide onClick={onBack}>
            Вернуться к карте
          </Button>
          <Button
            variant="ghost"
            wide
            onClick={() => {
              if (window.confirm('Сбросить карту и начать заново?')) onReset();
            }}
          >
            Сбросить всё
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

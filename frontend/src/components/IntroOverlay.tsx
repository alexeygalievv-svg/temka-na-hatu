import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { resolveIntroMessage } from '../lib/intro';
import { hasPhotoUrl } from '../lib/media';
import { Button } from './Button';

interface IntroOverlayProps {
  title: string;
  authorName: string | null;
  eyebrow: string;
  message: string;
  buttonText: string;
  photoPreview?: string | null;
  pointCount: number;
  onOpen?: () => void;
  /** Компактный предпросмотр в редакторе */
  compact?: boolean;
}

export function IntroOverlay({
  title,
  authorName,
  eyebrow,
  message,
  buttonText,
  photoPreview,
  pointCount,
  onOpen,
  compact = false,
}: IntroOverlayProps) {
  const meta = resolveIntroMessage(message, pointCount);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [photoPreview]);

  const showPhoto = hasPhotoUrl(photoPreview) && !broken;

  return (
    <div className={`intro-overlay${compact ? ' intro-overlay--compact' : ''}`}>
      <motion.span
        className="viewer__intro-eyebrow"
        initial={{ opacity: 0, y: compact ? 8 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {eyebrow.trim() || 'Для тебя собрал'}
      </motion.span>
      <motion.h1
        className="viewer__intro-title"
        initial={{ opacity: 0, y: compact ? 10 : 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {title.trim() || 'Карта воспоминаний'}
      </motion.h1>
      {authorName?.trim() && (
        <motion.span
          className="viewer__intro-author"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.45 }}
        >
          от {authorName.trim()}
        </motion.span>
      )}
      {showPhoto && (
        <motion.figure
          className={`intro-photo${compact ? ' intro-photo--compact' : ''}`}
          initial={{ opacity: 0, scale: 0.86, rotate: 8, y: 18 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: compact ? [-1.4, -0.3, -1.4] : [-2.2, -0.4, -2.2],
            y: compact ? [0, -3, 0] : [0, -7, 0],
          }}
          transition={{
            opacity: { delay: 0.26, duration: 0.4 },
            scale: { delay: 0.26, type: 'spring', stiffness: 180, damping: 16 },
            rotate: { delay: 0.55, duration: compact ? 5.2 : 6.2, repeat: Infinity, ease: 'easeInOut' },
            y: { delay: 0.55, duration: compact ? 5.2 : 6.2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <img
            src={photoPreview ?? ''}
            alt=""
            draggable={false}
            onError={() => setBroken(true)}
          />
        </motion.figure>
      )}
      <motion.div
        className="viewer__intro-meta"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.36, duration: 0.45 }}
      >
        {meta}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: compact ? 10 : 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {onOpen ? (
          <Button onClick={onOpen}>{buttonText.trim() || 'Открыть карту'}</Button>
        ) : (
          <span className="intro-overlay__button-preview">
            {buttonText.trim() || 'Открыть карту'}
          </span>
        )}
      </motion.div>
    </div>
  );
}

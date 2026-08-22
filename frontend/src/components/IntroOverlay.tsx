import { motion } from 'framer-motion';
import { resolveIntroMessage } from '../lib/intro';
import { Button } from './Button';

interface IntroOverlayProps {
  title: string;
  authorName: string | null;
  eyebrow: string;
  message: string;
  buttonText: string;
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
  pointCount,
  onOpen,
  compact = false,
}: IntroOverlayProps) {
  const meta = resolveIntroMessage(message, pointCount);

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

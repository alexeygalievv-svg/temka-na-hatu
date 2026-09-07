import { useRef } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import type { MemoryPoint } from '../types';
import { hasPhotoUrl } from '../lib/media';
import { useSheetReady } from '../lib/sheetOpen';
import { PlaceDate } from './PlaceDate';
import { Button } from './Button';

interface MemoryCardProps {
  point: MemoryPoint | null;
  index: number;
  total: number;
  onClose: () => void;
  /** Если false — карточку нельзя смахнуть или закрыть тапом по фону. */
  dismissible?: boolean;
  backLabel?: string;
  onBack?: () => void;
  nextLabel?: string;
  onNext?: () => void;
}

/** Карточка воспоминания: пружинный подъём, фото-«полароид», свайп вниз для закрытия. */
export function MemoryCard({
  point,
  index,
  total,
  onClose,
  dismissible = true,
  backLabel,
  onBack,
  nextLabel,
  onNext,
}: MemoryCardProps) {
  const dragControls = useDragControls();
  const cardRef = useRef<HTMLElement>(null);
  const showPhoto = hasPhotoUrl(point?.photoUrl);
  const ready = useSheetReady(point?.id ?? false);
  const canDismiss = dismissible && ready;
  const hasActions = Boolean((onNext && nextLabel) || (onBack && backLabel));

  return (
    <AnimatePresence>
      {point && (
        <>
          <motion.div
            className="sheet-backdrop sheet-backdrop--soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ pointerEvents: canDismiss ? 'auto' : 'none' }}
            onClick={canDismiss ? onClose : undefined}
          />
          <motion.article
            key={point.id}
            ref={cardRef}
            className="memory-card"
            initial={{ y: '108%' }}
            animate={{ y: 0 }}
            exit={{ y: '108%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            drag={canDismiss ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (!canDismiss) return;
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
          >
            <div
              className="memory-card__handle"
              onPointerDown={(event) => {
                if (!canDismiss) return;
                dragControls.start(event);
              }}
            >
              <div className="sheet__grip" aria-hidden="true" />
              <span className="memory-card__counter">
                {index + 1} из {total}
              </span>
            </div>

            <div className="memory-card__body">
              {showPhoto && (
                <motion.figure
                  className="memory-card__photo"
                  initial={{ scale: 0.94, rotate: 0, opacity: 0 }}
                  animate={{ scale: 1, rotate: -1.6, opacity: 1 }}
                  transition={{ delay: 0.16, type: 'spring', stiffness: 200, damping: 22 }}
                >
                  <img src={point.photoUrl ?? ''} alt={point.title} draggable={false} />
                </motion.figure>
              )}

              <motion.h2
                className="memory-card__title"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {point.title}
              </motion.h2>

              {point.description && (
                <motion.p
                  className="memory-card__text"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {point.description}
                </motion.p>
              )}

              {point.happenedOn && (
                <motion.div
                  className="memory-card__meta"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PlaceDate value={point.happenedOn} />
                </motion.div>
              )}

              {hasActions ? (
                <div className="memory-card__actions">
                  {onBack && backLabel ? (
                    <Button variant="ghost" wide onClick={onBack}>
                      {backLabel}
                    </Button>
                  ) : null}
                  {onNext && nextLabel ? (
                    <Button wide onClick={onNext}>
                      {nextLabel}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.article>
        </>
      )}
    </AnimatePresence>
  );
}

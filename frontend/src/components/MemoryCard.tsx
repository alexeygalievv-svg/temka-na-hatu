import { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import type { MemoryPoint } from '../types';
import { hasPhotoUrl } from '../lib/media';
import { PlaceDate } from './PlaceDate';

interface MemoryCardProps {
  point: MemoryPoint | null;
  index: number;
  total: number;
  onClose: () => void;
}

const COMPACT_RATIO = 0.78;
const EXPANDED_RATIO = 0.94;

/** Поднимает карточку выше, если описание не помещается в компактную высоту. */
function fitMemoryCardHeight(card: HTMLElement | null) {
  if (!card) return;
  card.style.maxHeight = '';

  const viewport = window.visualViewport?.height ?? window.innerHeight;
  const compactCap = Math.round(viewport * COMPACT_RATIO);
  const expandedCap = Math.round(viewport * EXPANDED_RATIO);

  card.style.maxHeight = 'none';
  const naturalHeight = card.offsetHeight;
  card.style.maxHeight = '';

  if (naturalHeight > compactCap + 6) {
    card.style.maxHeight = `${Math.min(naturalHeight, expandedCap)}px`;
  }
}

/** Карточка воспоминания: пружинный подъём, фото-«полароид», свайп вниз для закрытия. */
export function MemoryCard({ point, index, total, onClose }: MemoryCardProps) {
  const dragControls = useDragControls();
  const cardRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const showPhoto = hasPhotoUrl(point?.photoUrl);

  useLayoutEffect(() => {
    if (!point) return;

    const card = cardRef.current;
    const fit = () => fitMemoryCardHeight(card);

    fit();
    const frame = window.requestAnimationFrame(fit);

    const body = bodyRef.current;
    const observer = body ? new ResizeObserver(fit) : null;
    if (body) observer?.observe(body);

    const imgs = body?.querySelectorAll('img') ?? [];
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', fit, { once: true });
    });

    window.visualViewport?.addEventListener('resize', fit);
    window.addEventListener('resize', fit);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.visualViewport?.removeEventListener('resize', fit);
      window.removeEventListener('resize', fit);
      if (card) card.style.maxHeight = '';
    };
  }, [point]);

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
            onClick={onClose}
          />
          <motion.article
            key={point.id}
            ref={cardRef}
            className="memory-card"
            initial={{ y: '108%', scale: 0.92, opacity: 0.6 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: '108%', scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
          >
            <div
              className="memory-card__handle"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <div className="sheet__grip" aria-hidden="true" />
              <span className="memory-card__counter">
                {index + 1} из {total}
              </span>
            </div>

            <div ref={bodyRef} className="memory-card__body">
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
            </div>
          </motion.article>
        </>
      )}
    </AnimatePresence>
  );
}

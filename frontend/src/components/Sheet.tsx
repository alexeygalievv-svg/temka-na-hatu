import type { ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { hideSoftKeyboard } from '../lib/keyboard';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Нижняя панель: свайп вниз только за ручку, содержимое свободно скроллится. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose();
            }}
          >
            <div
              className="sheet__handle"
              onPointerDown={(event) => {
                hideSoftKeyboard();
                dragControls.start(event);
              }}
            >
              <div className="sheet__grip" aria-hidden="true" />
              {title && <h3 className="sheet__title">{title}</h3>}
            </div>
            <div className="sheet__body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

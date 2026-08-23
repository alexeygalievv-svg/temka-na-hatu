import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { hideSoftKeyboard } from '../lib/keyboard';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function keyboardOverlap(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
}

function scrollFieldIntoView(field: HTMLElement, scroller: HTMLElement) {
  const fieldBox = field.getBoundingClientRect();
  const scrollerBox = scroller.getBoundingClientRect();
  const padding = 18;
  if (fieldBox.top < scrollerBox.top + padding) {
    scroller.scrollTop -= scrollerBox.top + padding - fieldBox.top;
    return;
  }
  if (fieldBox.bottom > scrollerBox.bottom - padding) {
    scroller.scrollTop += fieldBox.bottom - (scrollerBox.bottom - padding);
  }
}

/** Нижняя панель: свайп вниз только за ручку, содержимое свободно скроллится. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return;

    const liftForKeyboard = () => {
      const overlap = keyboardOverlap();
      sheet.style.bottom = overlap > 8 ? `${overlap}px` : '0px';
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        body.contains(active) &&
        active.matches('input, textarea')
      ) {
        scrollFieldIntoView(active, body);
      }
    };

    const onFocus = (event: FocusEvent) => {
      const field = event.target;
      if (!(field instanceof HTMLElement) || !field.matches('input, textarea')) return;
      window.setTimeout(() => {
        liftForKeyboard();
        scrollFieldIntoView(field, body);
      }, 80);
      window.setTimeout(() => scrollFieldIntoView(field, body), 360);
    };

    liftForKeyboard();
    body.addEventListener('focusin', onFocus);
    window.visualViewport?.addEventListener('resize', liftForKeyboard);
    window.visualViewport?.addEventListener('scroll', liftForKeyboard);
    window.addEventListener('resize', liftForKeyboard);

    return () => {
      body.removeEventListener('focusin', onFocus);
      window.visualViewport?.removeEventListener('resize', liftForKeyboard);
      window.visualViewport?.removeEventListener('scroll', liftForKeyboard);
      window.removeEventListener('resize', liftForKeyboard);
      sheet.style.bottom = '';
    };
  }, [open]);

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
            ref={sheetRef}
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
            <div ref={bodyRef} className="sheet__body">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

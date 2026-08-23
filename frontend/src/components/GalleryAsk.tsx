import { createPortal } from 'react-dom';
import { Button } from './Button';

interface GalleryAskProps {
  onAllow: () => void;
  onDeny: () => void;
}

export function GalleryAsk({ onAllow, onDeny }: GalleryAskProps) {
  return createPortal(
    <div className="gallery-ask">
      <div className="gallery-ask__card">
        <p className="gallery-ask__title">Доступ к галерее</p>
        <p className="gallery-ask__text">
          Чтобы добавить фото, разрешите доступ к снимкам на этом устройстве.
        </p>
        <div className="gallery-ask__actions">
          <Button variant="ghost" onClick={onDeny}>
            Не сейчас
          </Button>
          <Button onClick={onAllow}>Разрешить</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

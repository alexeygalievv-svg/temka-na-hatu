import { Reorder, useDragControls } from 'framer-motion';
import type { DraftPoint } from '../types';
import { Sheet } from '../components/Sheet';
import { haptic } from '../telegram';

interface PointListSheetProps {
  open: boolean;
  points: DraftPoint[];
  onReorder: (points: DraftPoint[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function PointRow({
  point,
  index,
  onSelect,
  onDelete,
}: {
  point: DraftPoint;
  index: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={point}
      className="point-row"
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      whileDrag={{ scale: 1.03, boxShadow: '0 14px 34px rgba(58, 40, 25, 0.28)' }}
    >
      <button
        type="button"
        className="point-row__grip"
        aria-label="Перетащить"
        onPointerDown={(e) => {
          haptic('soft');
          controls.start(e);
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <circle cx="5" cy="3.5" r="1.4" /><circle cx="11" cy="3.5" r="1.4" />
          <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
          <circle cx="5" cy="12.5" r="1.4" /><circle cx="11" cy="12.5" r="1.4" />
        </svg>
      </button>

      <button type="button" className="point-row__body" onClick={() => onSelect(point.id)}>
        <span className="point-row__num">{index + 1}</span>
        {point.photoPreview ? (
          <img className="point-row__thumb" src={point.photoPreview} alt="" />
        ) : (
          <span className="point-row__thumb point-row__thumb--empty" />
        )}
        <span className="point-row__title">{point.title.trim() || `Место ${index + 1}`}</span>
      </button>

      <button
        type="button"
        className="point-row__delete"
        aria-label="Удалить"
        onClick={() => onDelete(point.id)}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </Reorder.Item>
  );
}

export function PointListSheet({ open, points, onReorder, onSelect, onDelete, onClose }: PointListSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Маршрут воспоминаний">
      <p className="point-list__hint">Порядок точек — это порядок, в котором их увидит получатель</p>
      <Reorder.Group
        axis="y"
        values={points}
        onReorder={onReorder}
        className="point-list"
        as="ul"
      >
        {points.map((point, index) => (
          <PointRow
            key={point.id}
            point={point}
            index={index}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </Reorder.Group>
    </Sheet>
  );
}

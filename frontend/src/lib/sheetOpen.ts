import { useEffect, useState } from 'react';

/** На Android открывающий тап ещё не закончился, когда панель уже на экране. */
export function useSheetReady(openKey: string | false, delay = 480) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!openKey) {
      setReady(false);
      return;
    }
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [openKey, delay]);

  return ready;
}

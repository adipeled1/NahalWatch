import { useCallback, useEffect, useState } from 'react';
import { loadSeries } from '@/lib/series';
import type { Sample } from '@/lib/types';

/** A station's full history. `error` is set when it can't be loaded (e.g. offline); `retry` tries again. */
export function useSeries(id: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; data: Sample[] | null; error: string | null }>({
    key: null, data: null, error: null,
  });
  const key = id ? `${id}#${attempt}` : null;
  useEffect(() => {
    if (!id || !key) return;
    let alive = true;
    loadSeries(id)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: Error) => alive && setState({ key, data: null, error: e.message || 'load failed' }));
    return () => { alive = false; };
  }, [id, key]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!id && !current, retry };
}

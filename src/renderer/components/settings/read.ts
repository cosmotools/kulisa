// Settings reads keep known data visible and discard replies superseded by a read, edit or unmount (README.md).
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { refused, type Result } from '../../../shared/result';

export function useRead<T extends object>(initial: T | null = null) {
  const [state, set] = useState({ data: initial, loading: true, error: '' });
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  const replace = useCallback((value: SetStateAction<T | null>) => {
    version.current++;
    set((s) => ({ data: typeof value === 'function' ? value(s.data) : value, loading: false, error: '' }));
  }, []);
  const read = useCallback(async (load: (publish: (data: T) => boolean) => Promise<Result<T>>, accept?: (data: T) => void) => {
    const n = ++version.current;
    const publish = (data: T) => {
      if (n !== version.current) return false;
      set((s) => ({ ...s, data })); return true;
    };
    set((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await load(publish);
      if (n !== version.current) return;
      if (refused(data)) throw new Error(data.error);
      set({ data, loading: false, error: '' }); accept?.(data);
    } catch (e) { if (n === version.current) set((s) => ({ ...s, loading: false, error: String(e) })); }
  }, []);
  return [state, read, replace] as const;
}

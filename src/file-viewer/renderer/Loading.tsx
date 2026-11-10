// One waiting deadline across recognition and decoding avoids flashing intermediate stages (../README.md).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const Started = createContext(0);
const DELAY = 200;
export function LoadingBoundary({ children }: { children: ReactNode }) {
  const [started] = useState(() => performance.now());
  return <Started.Provider value={started}>{children}</Started.Provider>;
}
export function Loading() {
  const started = useContext(Started);
  const [visible, setVisible] = useState(() => performance.now() - started >= DELAY);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), Math.max(0, DELAY - (performance.now() - started)));
    return () => clearTimeout(timer);
  }, [started]);
  return visible ? <span role="status">Loading…</span> : null;
}

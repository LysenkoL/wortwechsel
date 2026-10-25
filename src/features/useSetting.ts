import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting } from '../db/repo';

/** Reads a setting once and keeps a local copy in sync with IndexedDB. */
export function useSetting<T>(key: string, fallback: T): [T, (v: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getSetting<T>(key, fallback).then((v) => {
      if (alive) {
        setValue(v);
        setLoaded(true);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(async (v: T) => {
    setValue(v);
    await setSetting(key, v);
  }, [key]);

  return [value, set, loaded];
}

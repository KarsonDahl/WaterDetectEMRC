import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

/**
 * Minimal reactivity: every write in `repo.ts` calls `notifyChange()`, and
 * every `useLiveQuery` re-runs. The data set is small (hundreds of rows), so
 * re-querying everything is cheaper than tracking what changed.
 */
const listeners = new Set<() => void>();

export function notifyChange() {
  listeners.forEach((listener) => listener());
}

export type LiveQuery<T> = { data: T | undefined; error: Error | undefined };

export function useLiveQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: DependencyList): LiveQuery<T> {
  const db = useSQLiteContext();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<LiveQuery<T>>({ data: undefined, error: undefined });

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let stale = false;
    query(db).then(
      (data) => !stale && setState({ data, error: undefined }),
      (error: Error) => !stale && setState((prev) => ({ data: prev.data, error })),
    );
    return () => {
      stale = true;
    };
    // `query` is usually an inline arrow; callers list what it depends on in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return state;
}

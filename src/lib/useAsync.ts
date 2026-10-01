import { useEffect, useState } from 'react';

export type Async<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: string; data?: T };

/** Run `load` whenever `deps` change. Keeps the previous data while
 * reloading, and ignores results from superseded runs. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState((s) => ({ status: 'loading', data: s.data }));
    load().then(
      (data) => live && setState({ status: 'ready', data }),
      (err: unknown) =>
        live && setState((s) => ({ status: 'error', error: errorMessage(err), data: s.data })),
    );
    return () => {
      live = false;
    };
  }, deps);
  return state;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

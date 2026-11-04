// Settings' read snapshots live only while their cover or entity page is open. Lifecycle: README.md.
import { CancelledError, QueryClient, queryOptions } from '@tanstack/react-query';

export function createSettingsQuery<T>(queryKey: readonly unknown[], read: () => Promise<T>, first?: T) {
  let disposed = false;
  const client = new QueryClient({ defaultOptions: { queries: {
    gcTime: 0, retry: false, networkMode: 'always',
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  } } });
  const options = queryOptions({ queryKey, initialData: first, queryFn: async ({ signal }) => {
    const data = await read();
    // IPC keeps running in main; cancellation only discards its obsolete reply here.
    signal.throwIfAborted();
    return data;
  } });
  const load = () => disposed ? Promise.reject(new CancelledError()) : client.query(options);
  const refresh = () => {
    void client.cancelQueries({ queryKey: options.queryKey });
    return load();
  };
  const update = (value: T | ((before: T | undefined) => T | undefined)) => {
    if (disposed) return;
    void client.cancelQueries({ queryKey: options.queryKey });
    client.setQueryData(options.queryKey, value);
  };
  const dispose = () => { disposed = true; client.clear(); };
  return { client, options, load, refresh, update, dispose };
}

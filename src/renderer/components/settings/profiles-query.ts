// Settings' profile list lives only while its cover is open. Lifecycle and ownership: README.md.
import { CancelledError, QueryClient, queryOptions } from '@tanstack/react-query';
import type { SettingsProfile } from '../../../shared/types.ts';

export function createProfilesQuery(read: () => Promise<SettingsProfile[]>) {
  let disposed = false;
  const client = new QueryClient({ defaultOptions: { queries: {
    gcTime: 0, retry: false, networkMode: 'always',
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  } } });
  const options = queryOptions({ queryKey: ['profiles'], queryFn: async ({ signal }) => {
    const profiles = await read();
    // IPC keeps running in main; cancellation only discards its obsolete reply here.
    signal.throwIfAborted();
    return profiles;
  } });
  const load = () => disposed ? Promise.reject(new CancelledError()) : client.query(options);
  const refresh = () => {
    void client.cancelQueries({ queryKey: options.queryKey });
    return load();
  };
  const update = (profiles: SettingsProfile[]) => {
    if (disposed) return;
    void client.cancelQueries({ queryKey: options.queryKey });
    client.setQueryData(options.queryKey, profiles);
  };
  const dispose = () => { disposed = true; client.clear(); };
  return { client, options, load, refresh, update, dispose };
}

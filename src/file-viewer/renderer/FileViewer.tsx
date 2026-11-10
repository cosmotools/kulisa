// Common asynchronous viewing surface; engines own their resources (../README.md).
import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { FileSource, ViewerProps, ViewerRegistry } from './registry';
import { Loading, LoadingBoundary } from './Loading';

type Props = Omit<ViewerProps, 'signal'> & { registry: ViewerRegistry };
export function FileViewer(props: Props) {
  const { source } = props;
  return <section className="flex h-full min-h-0 min-w-0 flex-col bg-card text-foreground" aria-label={`File viewer: ${source.name}`}>
    <LoadingBoundary key={source.id}><Viewing {...props} /></LoadingBoundary>
  </section>;
}
function Viewing({ source, registry, ...host }: Props) {
  const [loaded, setLoaded] = useState<{ source: FileSource; content?: FileSource; controller: AbortController; Content?: ComponentType<ViewerProps>; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(), { signal } = controller;
    void (async () => {
      try {
        // Small local files fit in the recognition read; reuse that snapshot instead of another IPC/disk round trip.
        const header = await source.read(0, source.size <= 64 * 1024 ? source.size : 1024, signal);
        signal.throwIfAborted();
        const descriptor = registry.select(source, header.subarray(0, 1024));
        if (!descriptor) throw new Error('No viewer is available for this file.');
        const { default: Content } = await descriptor.load();
        const content = header.length === source.size ? { ...source, read: async (offset: number, length: number, reading: AbortSignal) => {
          signal.throwIfAborted(); reading.throwIfAborted();
          return header.slice(offset, offset + length);
        } } : source;
        if (!signal.aborted) setLoaded({ source, content, controller, Content });
      } catch (error) {
        if (!signal.aborted) setLoaded({ source, controller, error: (error as Error).message });
      }
    })();
    return () => controller.abort();
  }, [source, registry]);
  if (!loaded || loaded.source !== source || loaded.controller.signal.aborted) return <Loading />;
  if (loaded.error || !loaded.Content) return <div className="overflow-auto p-4"><p role="status" data-selectable>{loaded.error}</p></div>;
  return <ViewerError><loaded.Content source={loaded.content ?? source} signal={loaded.controller.signal} {...host} /></ViewerError>;
}
class ViewerError extends Component<{ children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() {
    return this.state.error ? <div className="overflow-auto p-4"><p role="alert" data-selectable>{this.state.error}</p></div> : this.props.children;
  }
}

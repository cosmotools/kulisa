// Common asynchronous viewing surface; engines own their resources (../README.md).
import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { FileSource, ViewerProps, ViewerRegistry } from './registry';

type Props = Omit<ViewerProps, 'signal'> & { registry: ViewerRegistry };
export function FileViewer(props: Props) {
  const { source } = props;
  return <section className="flex h-full min-h-0 min-w-0 flex-col bg-card text-foreground" aria-label={`File viewer: ${source.name}`}>
    <Viewing key={source.id} {...props} />
  </section>;
}
function Viewing({ source, registry, appearance, pdf }: Props) {
  const [loaded, setLoaded] = useState<{ source: FileSource; controller: AbortController; Content?: ComponentType<ViewerProps>; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(), { signal } = controller;
    void (async () => {
      try {
        const header = await source.read(0, Math.min(source.size, 1024), signal);
        signal.throwIfAborted();
        const descriptor = registry.select(source, header);
        if (!descriptor) throw new Error('No viewer is available for this file.');
        const { default: Content } = await descriptor.load();
        if (!signal.aborted) setLoaded({ source, controller, Content });
      } catch (error) {
        if (!signal.aborted) setLoaded({ source, controller, error: (error as Error).message });
      }
    })();
    return () => controller.abort();
  }, [source, registry]);
  if (!loaded || loaded.source !== source || loaded.controller.signal.aborted) return <p role="status">Loading file…</p>;
  if (loaded.error || !loaded.Content) return <div className="overflow-auto p-4"><p role="status" data-selectable>{loaded.error}</p></div>;
  return <ViewerError><loaded.Content source={source} signal={loaded.controller.signal} appearance={appearance} pdf={pdf} /></ViewerError>;
}
class ViewerError extends Component<{ children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() {
    return this.state.error ? <div className="overflow-auto p-4"><p role="alert" data-selectable>{this.state.error}</p></div> : this.props.children;
  }
}

// Common asynchronous viewing surface; engines own their resources (../README.md).
import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { FileSource, ViewerAppearance, ViewerCapabilities, ViewerProps, ViewerRegistry } from './registry';

const appearanceDefault: ViewerAppearance = {}, capabilitiesDefault: ViewerCapabilities = {};
interface Props {
  source: FileSource;
  registry: ViewerRegistry;
  appearance?: ViewerAppearance;
  capabilities?: ViewerCapabilities;
  viewer?: string;
  fallback?: ReactNode;
}
export function FileViewer({ source, registry, appearance = appearanceDefault, capabilities = capabilitiesDefault, viewer, fallback }: Props) {
  return <section className="flex h-full min-h-0 min-w-0 flex-col bg-card text-foreground" aria-label={`File viewer: ${source.name}`}>
    <Viewing key={source.id} source={source} registry={registry} appearance={appearance} capabilities={capabilities} viewer={viewer} fallback={fallback} />
  </section>;
}
function Viewing({ source, registry, appearance, capabilities, viewer, fallback }: Required<Pick<Props, 'source' | 'registry' | 'appearance' | 'capabilities'>> & Pick<Props, 'viewer' | 'fallback'>) {
  const [loaded, setLoaded] = useState<{ source: FileSource; controller: AbortController; Content?: ComponentType<ViewerProps>; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(), { signal } = controller;
    void (async () => {
      try {
        const header = await source.read(0, Math.min(source.size, 1024), signal);
        signal.throwIfAborted();
        const descriptor = registry.select(source, header, capabilities, viewer);
        if (!descriptor) throw new Error('No viewer is available for this file.');
        const { default: Content } = await descriptor.load();
        if (!signal.aborted) setLoaded({ source, controller, Content });
      } catch (error) {
        if (!signal.aborted) setLoaded({ source, controller, error: (error as Error).message });
      }
    })();
    return () => controller.abort();
  }, [source, registry, capabilities, viewer]);
  if (!loaded || loaded.source !== source || loaded.controller.signal.aborted) return <p role="status">Loading file…</p>;
  if (loaded.error || !loaded.Content) return <div className="overflow-auto p-4"><p role="status" data-selectable>{loaded.error}</p>{fallback}</div>;
  return <ViewerError key={source.id} fallback={fallback}><loaded.Content source={source} signal={loaded.controller.signal} appearance={appearance} capabilities={capabilities} /></ViewerError>;
}
class ViewerError extends Component<{ children: ReactNode; fallback: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  override render() {
    return this.state.error ? <div className="overflow-auto p-4"><p role="alert" data-selectable>{this.state.error}</p>{this.props.fallback}</div> : this.props.children;
  }
}

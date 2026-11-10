// Format recognition and extensible engine selection (../README.md).
import type { ComponentType } from 'react';
import type { ViewerBox, ViewerSearchResult } from '../ipc.ts';
export type { ViewerBox } from '../ipc.ts';

export interface FileSource {
  /** Change identity when the underlying contents change. */
  id: string;
  name: string;
  size: number;
  mime?: string;
  /** Return at most length bytes; the host authorizes each read. */
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array>;
}
interface ViewerAppearance {
  shade: 'light' | 'dark';
  fontFamily: string;
  fontSize: number;
}
export interface NativePdfLease {
  place(box: ViewerBox): Promise<void>;
  dispose(): void;
  find(query: string, forward: boolean): Promise<ViewerSearchResult>;
}
export interface PdfHost {
  open(box: ViewerBox, signal: AbortSignal): Promise<NativePdfLease>;
  onFindRequested(listener: () => void): () => void;
}
export interface DocumentHost {
  resolve(href: string, signal: AbortSignal): Promise<FileSource>;
  open(href: string): Promise<void>;
}
export interface MediaHost {
  visible: boolean;
  open(signal: AbortSignal): Promise<string>;
}
export interface ViewerProps {
  source: FileSource;
  signal: AbortSignal;
  appearance: ViewerAppearance;
  pdf: PdfHost;
  document: DocumentHost;
  media: MediaHost;
}
export interface ViewerDescriptor {
  id: string;
  mime: readonly string[];
  extensions?: readonly string[];
  priority?: number;
  /** A bounded header probe can recognize formats lacking useful metadata. */
  probe?(header: Uint8Array): boolean;
  load(): Promise<{ default: ComponentType<ViewerProps> }>;
}
export interface ViewerRegistry {
  select(source: FileSource, header: Uint8Array): ViewerDescriptor | undefined;
}

export function identifyMime(header: Uint8Array, supplied?: string): string {
  if (new TextDecoder().decode(header.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  const mime = supplied?.split(';')[0]?.trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream') return mime;
  try {
    // Streaming decode permits a UTF-8 character split at the bounded probe's edge.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(header, { stream: true });
    if (!/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text)) return 'text/plain';
  } catch { /* Unknown encodings remain available to a host-supplied viewer. */ }
  return 'application/octet-stream';
}

export function createViewerRegistry(descriptors: readonly ViewerDescriptor[]): ViewerRegistry {
  const viewers = new Map<string, ViewerDescriptor>();
  for (const descriptor of descriptors) viewers.set(descriptor.id, descriptor);
  return {
    select(source, header) {
      const mime = identifyMime(header, source.mime);
      const supplied = source.mime?.split(';')[0]?.trim().toLowerCase();
      const specific = mime === 'application/pdf' || !!supplied && supplied !== 'application/octet-stream' && supplied !== 'text/plain';
      const extension = source.name.toLowerCase().split('.').at(-1);
      const matches = [...viewers.values()].flatMap((viewer, order) => {
        const exact = viewer.mime.some((pattern) => pattern.toLowerCase() === mime);
        const wildcard = viewer.mime.some((pattern) => pattern.endsWith('/*') && mime.startsWith(pattern.slice(0, -1).toLowerCase()));
        const probe = viewer.probe?.(header) ?? false;
        const fallback = !specific && viewer.extensions?.some((ext) => ext.toLowerCase().replace(/^\./, '') === extension);
        // Generic text recognition must not swallow future CSV/Markdown viewers registered by extension/probe.
        const score = Math.max(exact ? specific ? 6 : 2 : 0, wildcard ? specific ? 5 : 1 : 0, probe ? 4 : 0, fallback ? 3 : 0);
        return score ? [{ viewer, score, order }] : [];
      });
      matches.sort((a, b) => b.score - a.score || (b.viewer.priority ?? 0) - (a.viewer.priority ?? 0) || a.order - b.order);
      return matches[0]?.viewer;
    },
  };
}

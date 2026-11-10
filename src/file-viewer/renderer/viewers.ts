// Built-in registrations; importing the registry does not import rendering engines (../README.md).
import type { ViewerDescriptor } from './registry';
import { hasImageHeader } from './image-header.ts';
export const textViewer: ViewerDescriptor = {
  id: 'text', mime: ['text/*', 'application/json', 'application/xml', 'application/yaml', 'application/toml', 'application/javascript', 'application/sql', 'application/x-ndjson', 'image/svg+xml'],
  load: () => import('./viewers/text/TextViewer'),
};
export const pdfViewer: ViewerDescriptor = {
  id: 'pdf', mime: ['application/pdf'], extensions: ['pdf'],
  load: () => import('./viewers/pdf/PdfViewer'),
};
export const imageViewer: ViewerDescriptor = {
  id: 'image', mime: ['image/*', 'image/svg+xml'], priority: 1,
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd'],
  probe: hasImageHeader, load: () => import('./viewers/image/ImageViewer'),
};
export const markdownViewer: ViewerDescriptor = {
  id: 'markdown', mime: ['text/markdown', 'text/x-markdown'], extensions: ['md', 'markdown'],
  load: () => import('./viewers/markdown/MarkdownViewer'),
};
export const audioViewer: ViewerDescriptor = {
  id: 'audio', mime: ['audio/*', 'application/ogg'], extensions: ['wav', 'mp3', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'],
  load: async () => ({ default: (await import('./viewers/media/MediaViewer')).AudioViewer }),
};
export const videoViewer: ViewerDescriptor = {
  id: 'video', mime: ['video/*'], extensions: ['mp4', 'webm', 'mov', 'ogv', 'm4v'],
  load: async () => ({ default: (await import('./viewers/media/MediaViewer')).VideoViewer }),
};

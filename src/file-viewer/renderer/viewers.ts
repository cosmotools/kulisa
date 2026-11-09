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

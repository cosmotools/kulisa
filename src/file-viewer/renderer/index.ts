// Renderer entry; the host supplies authorized file reads and native PDF access (../README.md).
export { FileViewer } from './FileViewer';
export { createViewerRegistry } from './registry';
export { textViewer, pdfViewer, imageViewer } from './viewers';
export type { FileSource, PdfHost } from './registry';

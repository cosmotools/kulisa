// Public browser/React entry; native implementations are supplied as capabilities (../README.md).
export { FileViewer } from './FileViewer';
export { createViewerRegistry } from './registry';
export { textViewer, pdfViewer, imageViewer } from './viewers';
export type { FileSource, ViewerAppearance, ViewerCapabilities, ViewerDescriptor, ViewerRegistry, ViewerProps } from './registry';

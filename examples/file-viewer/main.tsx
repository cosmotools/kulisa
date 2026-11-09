// Standalone consumer: no Kulisa store, preload, IPC, UI components or global styles.
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileViewer, createViewerRegistry, textViewer, pdfViewer, imageViewer } from '../../src/file-viewer/renderer';
import type { FileSource, ViewerAppearance, ViewerDescriptor, ViewerProps, ViewerRegistry } from '../../src/file-viewer/renderer';
import './style.css';

function ExampleViewer({ source, signal }: ViewerProps) {
  const [value, setValue] = useState('');
  useEffect(() => {
    void source.read(0, Math.min(source.size, 64 * 1024), signal).then((bytes) => { if (!signal.aborted) setValue(new TextDecoder().decode(bytes)); });
  }, [source, signal]);
  return <output aria-label="Custom preview">{value}</output>;
}
const customViewer: ViewerDescriptor = {
  id: 'example', mime: ['application/x-viewer-example'], load: async () => ({ default: ExampleViewer }),
};
const registry: ViewerRegistry = createViewerRegistry([textViewer, pdfViewer, imageViewer, customViewer]);
function App() {
  const [file, setFile] = useState<File | null>(null), [dark, setDark] = useState(false);
  const source = useMemo<FileSource | null>(() => file ? {
    id: `${file.name}:${file.lastModified}:${file.size}`, name: file.name, size: file.size,
    mime: file.name.endsWith('.example') ? 'application/x-viewer-example' : file.type,
    read: async (offset, length, signal) => {
      signal.throwIfAborted();
      const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
      signal.throwIfAborted(); return bytes;
    },
  } : null, [file]);
  const appearance: ViewerAppearance = { shade: dark ? 'dark' : 'light', fontSize: 14 };
  return <main data-dark={dark}>
    <header><label>Choose a file <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <button type="button" onClick={() => setFile(null)}>Close file</button>
      <button type="button" aria-pressed={dark} onClick={() => setDark(!dark)}>Dark theme</button></header>
    <div className="preview">{source ? <FileViewer source={source} registry={registry} appearance={appearance} /> : <p>Choose a UTF-8 text file or image. A .example file demonstrates registering another viewer. PDF needs an explicit host adapter.</p>}</div>
  </main>;
}
createRoot(document.getElementById('app')!).render(<App />);

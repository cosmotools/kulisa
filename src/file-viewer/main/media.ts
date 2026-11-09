// Revocable media URLs with backpressure and bounded authorized reads (../README.md).
import electron from 'electron';
import { randomUUID } from 'node:crypto';

interface MediaSource {
  size: number;
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array>;
}
const CHUNK = 256 * 1024;

export function mediaResponse(request: Request, source: MediaSource, signal: AbortSignal): Response {
  if (signal.aborted) return new Response(null, { status: 410 });
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  const range = request.headers.get('range');
  let start = 0, end = source.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || !match[1] && !match[2]) return unsatisfied(source.size);
    if (!match[1]) start = Math.max(0, source.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (![start, end].every(Number.isSafeInteger) || start > end || start < 0) return unsatisfied(source.size);
  }
  const headers = new Headers({ 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes',
    'Content-Length': String(Math.max(0, end - start + 1)), 'Cache-Control': 'no-store' });
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${source.size}`);
  const controller = new AbortController();
  let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const abort = () => { controller.abort(); bodyController?.error(controller.signal.reason); cleanup(); };
  const cleanup = () => { signal.removeEventListener('abort', abort); request.signal.removeEventListener('abort', abort); };
  signal.addEventListener('abort', abort, { once: true }); request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  const body = request.method === 'HEAD' ? null : new ReadableStream<Uint8Array>({
    start(stream) { bodyController = stream; if (controller.signal.aborted) stream.error(controller.signal.reason); },
    async pull(stream) {
      try {
        controller.signal.throwIfAborted();
        if (start > end) { cleanup(); stream.close(); return; }
        const length = Math.min(CHUNK, end - start + 1);
        const bytes = await source.read(start, length, controller.signal);
        controller.signal.throwIfAborted();
        if (bytes.length !== length) throw new Error('The media file changed while reading.');
        start += bytes.length; stream.enqueue(bytes);
        if (start > end) { cleanup(); stream.close(); }
      } catch (error) { cleanup(); stream.error(error); }
    },
    cancel() { bodyController = undefined; abort(); },
  }, { highWaterMark: 0 });
  if (!body) cleanup();
  return new Response(body, { status: range ? 206 : 200, headers });
}
function unsatisfied(size: number) { return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } }); }

const sessions = new WeakMap<Electron.Session, Map<string, { source: MediaSource; controller: AbortController }>>();
export function installMediaProtocol(session: Electron.Session) {
  let sources = sessions.get(session);
  if (!sources) {
    sources = new Map(); sessions.set(session, sources);
    const registered = sources;
    session.protocol.handle('artifact-media', (request) => {
      const entry = registered.get(request.url);
      return entry ? mediaResponse(request, entry.source, entry.controller.signal) : new Response(null, { status: 404 });
    });
  }
  return sources;
}
export function openMedia(session: Electron.Session, source: MediaSource) {
  const sources = installMediaProtocol(session);
  const url = `artifact-media://content/${randomUUID()}`, controller = new AbortController();
  sources.set(url, { source, controller });
  return { url, dispose() { sources.delete(url); controller.abort(); } };
}

export function registerViewerSchemes(additionalSchemes: Electron.CustomScheme[] = []) {
  // PDF needs a standard origin for toolbar metadata; media needs stream privileges for seeking.
  electron.protocol.registerSchemesAsPrivileged([...['file-viewer', 'artifact-media'].map((scheme) => ({
    scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  })), ...additionalSchemes]);
}

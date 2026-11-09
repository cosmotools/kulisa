// Shared bounded UTF-8 validation for source and formatted documents (../../../README.md).
import type { FileSource } from '../../registry.ts';

export async function readText(source: FileSource, signal: AbortSignal, limit = 4 * 1024 * 1024) {
  if (source.size > limit) throw new Error(limit === 4 * 1024 * 1024 ? 'Text preview is limited to 4 MiB.' : 'Formatted Markdown is limited to 256 KiB. Choose Source to read this file.');
  const bytes = await source.read(0, source.size, signal);
  signal.throwIfAborted();
  if (bytes.length !== source.size) throw new Error('The file changed while opening. Select it again to reload.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text)) throw new Error('This file contains binary data.');
  if (text.split(/\r\n|\r|\n/).length > 100_000) throw new Error('Text preview is limited to 100,000 lines.');
  return text;
}

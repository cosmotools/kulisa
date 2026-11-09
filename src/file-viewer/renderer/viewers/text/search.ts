// Literal full-document search, bounded independently of the virtualized DOM (../../../README.md).
export function findText(text: string, query: string, limit = 10_000): { lines: number[]; truncated: boolean } {
  if (!query) return { lines: [], truncated: false };
  const lines: number[] = [];
  // Per-line folding preserves line positions even where Unicode lowercase changes string length.
  const needle = query.toLowerCase();
  let number = 1;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const folded = line.toLowerCase();
    for (let start = 0, found = folded.indexOf(needle, start); found !== -1; found = folded.indexOf(needle, start)) {
      if (lines.length === limit) return { lines, truncated: true };
      lines.push(number); start = found + needle.length;
    }
    number++;
  }
  return { lines, truncated: false };
}

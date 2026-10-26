// The fake agent's dictation recognizing for another agent (test/e2e/app.ts; src/dictation's hidden session), as Claude Code's
// does: its prompt, "listening…" while its key comes, and once it stops, what it heard posted to its hook
// (KULISA_URL's hooks/prompt) as Claude Code's UserPromptSubmit hook posts it; the answer printed (a block).
// Plain JavaScript: run by the node on PATH, outside Kulisa.
process.stdin.setRawMode?.(true);
process.stdout.write('❯ ');
let quiet = null;
process.stdin.on('data', (d) => {
  if (!String(d).includes(' ')) return; // its input emptied, Enter: nothing to do
  if (!quiet) process.stdout.write('\r\nlistening…');
  clearTimeout(quiet);
  quiet = setTimeout(async () => {
    quiet = null;
    const r = await fetch(`${process.env.KULISA_URL}/hooks/prompt`, { method: 'POST', body: JSON.stringify({ prompt: 'Heard by the fake recognizer.' }) });
    process.stdout.write(`\r\n${await r.text()}\r\n❯ `);
  }, 300);
});

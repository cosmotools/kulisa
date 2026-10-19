// An agent's arguments typed into the user's shell (shell-quote.ts) arrive as they were, in each shell installed here.
import { test } from 'node:test';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { shellQuote } from './main/shell-quote.ts';

const ARGS = ['plain', '', 'two words', "it's", '$HOME', '*', '!x', '{"a":"b \\"c\\""}', 'back\\slash', 'back\\\\two',
  "q\\'x", 'end\\', "'", 'line\nbreak', 'café ✓'];
const where = (shell: string) => { try { return execFileSync('/bin/sh', ['-c', `command -v ${shell}`]).toString().trim(); } catch { return ''; } };

for (const name of ['sh', 'bash', 'zsh', 'fish']) {
  const shell = where(name);
  test(`shell quote: ${name}`, { skip: process.platform === 'win32' || !shell ? `no ${name}` : false }, () => {
    // Each argument on a line of its own, as a command typed in the shell gets it.
    const line = `printf '%s\\0' ${ARGS.map((a) => shellQuote(shell, a)).join(' ')}`;
    const out = execFileSync(shell, name === 'fish' ? ['--no-config', '-c', line] : ['-c', line]).toString();
    assert.deepEqual(out.split('\0').slice(0, -1), ARGS);
  });
}

test('shell quote: a plain word as it is; fish by its program\'s name', () => {
  assert.equal(shellQuote('/bin/zsh', '--plugin-dir=/a/b'), '--plugin-dir=/a/b');
  assert.equal(shellQuote('/bin/zsh', "a\\'b"), `'a\\'\\''b'`);
  assert.equal(shellQuote('/opt/homebrew/bin/fish', "a\\'b"), `'a\\\\\\'b'`);
});

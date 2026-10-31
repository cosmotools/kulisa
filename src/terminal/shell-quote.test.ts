// An agent's arguments typed into the user's shell (shell-quote.ts) arrive as they were, in each shell installed here.
import { test } from 'node:test';
import assert from 'assert/strict';
import { execFileSync, spawnSync } from 'child_process';
import { shellLine, shellQuote, quotePaths, executionLine } from './main/shell-quote.ts';

const ARGS = ['plain', '', 'two words', "it's", '$HOME', '*', '!x', '{"a":"b \\"c\\""}', 'back\\slash', 'back\\\\two',
  "q\\'x", 'end\\', "'", 'line\nbreak', 'café ✓'];
// What only PowerShell reads in a word, and what a Windows program's command line makes of quotes and backslashes; a
// hook's command and a JSON with spaces, as the agents get them.
const PS_ARGS = [...ARGS.filter((a) => !a.includes('\n')), 'two words\\', 'a"b', 'x\\"y', '"quoted"', ' lead', '%PATH%', '`x',
  'a;b', 'a|b', 'a&b', '@x', 'a,b', '-x', '$(x)', 'C:\\a b\\c', 'curl -sf "$KULISA_URL/hooks/x" || true', '{"a b": "c \\\\"}'];
const where = (shell: string) => {
  try {
    const out = process.platform === 'win32' ? execFileSync('where.exe', [shell]) : execFileSync('/bin/sh', ['-c', `command -v ${shell}`]);
    return out.toString().split(/\r?\n/)[0]!.trim();
  } catch { return ''; }
};

for (const name of ['sh', 'bash', 'zsh', 'fish']) {
  const shell = process.platform === 'win32' ? '' : where(name);
  test(`shell quote: ${name}`, { skip: !shell ? `no ${name}` : false }, () => {
    // Each argument on a line of its own, as a command typed in the shell gets it.
    const line = `printf '%s\\0' ${ARGS.map((a) => shellQuote(shell, a)).join(' ')}`;
    const out = execFileSync(shell, name === 'fish' ? ['--no-config', '-c', line] : ['-c', line]).toString();
    assert.deepEqual(out.split('\0').slice(0, -1), ARGS);
  });
}

// The line typed into PowerShell runs a program (Node here) that prints the arguments it got, with a pinned variable.
for (const name of ['powershell', 'pwsh']) {
  const shell = where(name);
  test(`shell quote: ${name}`, { skip: !shell ? `no ${name}` : false }, () => {
    const print = 'console.log(JSON.stringify([process.env.PINNED, ...process.argv.slice(1)]))';
    const line = shellLine(shell, process.execPath, ['-e', print, ...PS_ARGS], { PINNED: "it's C:\\x" });
    const out = execFileSync(shell, ['-NoLogo', '-NoProfile', '-Command', line], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(out), ["it's C:\\x", ...PS_ARGS]);
  });
}

test('shell quote: a plain word as it is; fish by its program\'s name; PowerShell by its own', () => {
  assert.equal(shellQuote('/bin/zsh', '--plugin-dir=/a/b'), '--plugin-dir=/a/b');
  assert.equal(shellQuote('/bin/zsh', "a\\'b"), `'a\\'\\''b'`);
  assert.equal(shellQuote('/opt/homebrew/bin/fish', "a\\'b"), `'a\\\\\\'b'`);
  assert.equal(shellQuote('C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'C:\\a\\b'), 'C:\\a\\b');
  assert.equal(shellQuote('powershell.exe', "it's"), "'it''s'");
  assert.equal(shellLine('/bin/bash', 'claude', ['--x'], { A: 'b c' }), "A='b c' claude --x");
});

for (const name of ['sh', 'bash', 'zsh', 'fish', 'powershell', 'pwsh']) {
  const shell = where(name);
  test(`dropped paths stay literal: ${name}`, { skip: !shell ? `no ${name}` : false }, () => {
    const paths = ['plain.png', "a b/it's $HOME; & (image).png", 'café.png', 'back\\slash.png'];
    const ps = ['powershell', 'pwsh'].includes(name);
    // PowerShell 5 writes JSON in the console's code page; this fixture reads UTF-8.
    const command = ps ? `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & { ConvertTo-Json -Compress -InputObject @($args) } ${quotePaths(shell, paths)}`
      : `printf '%s\\0' ${quotePaths(shell, paths)}`;
    const out = execFileSync(shell, ps ? ['-NoLogo', '-NoProfile', '-Command', command]
      : name === 'fish' ? ['--no-config', '-c', command] : ['-c', command], { encoding: 'utf8' });
    assert.deepEqual(ps ? JSON.parse(out) : out.split('\0').slice(0, -1), paths);
  });
}

for (const name of ['sh', 'bash', 'zsh', 'fish', 'powershell', 'pwsh']) {
  const shell = where(name);
  test(`application launch preserves output and native exit status: ${name}`, { skip: !shell ? `no ${name}` : false }, () => {
    const command = shellLine(shell, process.execPath, ['-e', "process.stdout.write('application output');process.exit(7)"]);
    const line = executionLine(shell, command);
    const ps = ['powershell', 'pwsh'].includes(name);
    const r = spawnSync(shell, ps ? ['-NoLogo', '-NoProfile', '-Command', line] : ['-c', line], { encoding: 'utf8' });
    assert.equal(r.status, 7, r.stderr);
    assert.equal(r.stdout, 'application output');
  });
}

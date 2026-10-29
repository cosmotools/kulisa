// The development launcher's environment, without starting Electron or touching the user's data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

test('the launcher leaves terminal color preferences to the app’s own shells', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-launcher-'));
  try {
    const skill = path.join(dir, '.agents/skills/run-kulisa');
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(skill, { recursive: true });
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.copyFileSync(path.join(import.meta.dirname, '../../.agents/skills/run-kulisa/kulisa.sh'), path.join(skill, 'kulisa.sh'));
    // Stub only the OS and launch commands: the real launcher selects each platform's branch and builds its environment.
    const commands: Record<string, string> = {
      uname: 'echo "$LAUNCH_OS"', ps: ':', npx: ':',
      cygpath: 'echo "${@: -1}"',
      setsid: 'capture', open: 'capture', powershell: 'case "$*" in *Start-Process*) capture ;; esac',
    };
    for (const [name, body] of Object.entries(commands)) fs.writeFileSync(path.join(bin, name), `#!/usr/bin/env bash
capture() {
  printf '%s\\n' "\${NO_COLOR-unset}" "\${FORCE_COLOR-unset}" "\${CLICOLOR-unset}" "\${CLICOLOR_FORCE-unset}" > "$LAUNCH_ENV"
  echo 'MCP server' >> "$LAUNCH_LOG"
}
${body}
`, { mode: 0o755 });
    for (const platform of ['Linux', 'Darwin', 'MINGW64_NT']) {
      const capture = path.join(dir, 'environment');
      execFileSync('bash', [path.join(skill, 'kulisa.sh'), 'start'], {
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, APPDATA: dir,
          LAUNCH_OS: platform, LAUNCH_ENV: capture, LAUNCH_LOG: path.join(dir, 'dist/kulisa.log'),
          NO_COLOR: '1', FORCE_COLOR: '0', CLICOLOR: '0', CLICOLOR_FORCE: '0' },
        timeout: 10000,
      });
      assert.deepEqual(fs.readFileSync(capture, 'utf8').trim().split('\n'), Array(4).fill('unset'), platform);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

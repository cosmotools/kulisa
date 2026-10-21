// The start of a group that does not begin with agent.ts (start.ts): the profiles and the agent's session as
// agent.ts and profiles.ts leave them, made through the core, without testing it again.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { assert, project, pfile, SITE, waitFor, who, hooksOf, idOf } from './helpers.ts';
import type { Test } from './run.ts';

export default (test: Test) => {
  test('setup: Sam signed in, Elon signed out, Dora closed; the agent reported its session', async (ctx) => {
    const { shell, call, ui } = ctx, task = shell.task;
    await task.createProfile('Sam.admin', 'seller in the test shop', 'fox');
    await task.createProfile('Elon.buyer', '', 'owl');
    task.describeProfile(idOf('Elon.buyer'), ''); // said, and left empty by the human
    await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app/login?name=sam` });
    await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'Sam.admin'), 'Signed in as sam');
    await task.createProfile('Dora');
    await call('browser_navigate', { profile: 'Dora', url: `${SITE}/app/login?name=dora` });
    await task.closeProfile(idOf('Dora'));
    // Its SessionStart hook, as Claude Code sends it: Kulisa resumes this session when the project opens again.
    const transcript = path.join(project, 'transcript.jsonl');
    fs.writeFileSync(transcript, '');
    await new Promise((resolve) => http.request(`${hooksOf(task)}/session-start`, { method: 'POST' }, (res) => { res.resume(); res.on('end', resolve); })
      .end(JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' })));
    await waitFor(() => JSON.parse(fs.readFileSync(pfile('agent.json'), 'utf8')).conversations[0].sessionId === 'session-1');
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);
  });
};

// The start of a group that does not begin with agent.js (start.js): the profiles and the agent's session as
// agent.js and profiles.js leave them, made through the core, without testing it again.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { assert, project, pfile, SITE, waitFor, who } = require('./helpers');

module.exports = (test) => {
  test('setup: Sam signed in, Elon signed out, Dora closed; the agent reported its session', async (ctx) => {
    const { shell, call, ui } = ctx, task = shell.task;
    await task.createProfile('Sam.admin', 'seller in the test shop', 'fox');
    await task.createProfile('Elon.buyer', '', 'owl');
    task.describeProfile('elon-buyer', ''); // said, and left empty by the human
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app/login?name=sam` });
    await call('browser_navigate', { profile: 'elon-buyer', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await task.createProfile('Dora');
    await call('browser_navigate', { profile: 'dora', url: `${SITE}/app/login?name=dora` });
    await task.closeProfile('dora');
    // Its SessionStart hook, as Claude Code sends it: Kulisa resumes this session when the project opens again.
    const transcript = path.join(project, 'transcript.jsonl');
    fs.writeFileSync(transcript, '');
    await new Promise((resolve) => http.request(`${task.env().KULISA_URL}/hooks/session-start`, { method: 'POST' }, (res) => { res.resume(); res.on('end', resolve); })
      .end(JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' })));
    await waitFor(() => JSON.parse(fs.readFileSync(pfile('agent.json'), 'utf8')).sessionId === 'session-1');
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);
  });
};

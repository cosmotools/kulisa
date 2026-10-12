// Agents' transcripts read as a task's history (transcripts.ts): what is kept, cut and left out of Claude Code's and Codex's.
// Plain Node (npm run test:unit), on a transcript made here in its format (no real conversation in git).
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CUT } from '../../src/main/transcripts.ts';
import { claudeConversation } from '../../src/main/agents/claude.ts';
import { codexConversation } from '../../src/main/agents/codex.ts';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

// A record of each kind Claude Code 2.1.296 writes (docs/transcripts.md: the reader's table).
const user = (content: unknown, more = {}) => ({ type: 'user', message: { role: 'user', content }, ...more });
const assistant = (...content: object[]) => ({ type: 'assistant', message: { role: 'assistant', content } });
const use = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const result = (id: string, content: unknown, is_error = false) => ({ type: 'tool_result', tool_use_id: id, content, is_error });
const write = (name: string, records: object[]) => {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 's.jsonl');
  fs.writeFileSync(file, `${records.map((r) => JSON.stringify(r)).join('\n')}\nnot json\n`);
  return file;
};

test("history: a Claude Code transcript gives the human's words, the agent's answers and actions, their results cut, its summaries", () => {
  const long = `${'a'.repeat(CUT)}${'m'.repeat(10_000)}${'z'.repeat(CUT)}`;
  const file = write('claude', [
    { type: 'permission-mode', permissionMode: 'default' },
    user('Make the pay button green'),
    user('<command-name>/x</command-name>', { isMeta: true }),
    assistant({ type: 'thinking', thinking: 'secret', signature: 'sig' }, { type: 'text', text: 'Looking at the cart.' }, use('t1', 'Read', { file_path: '/p/cart.ts' })),
    user([result('t1', 'export const PAY = "red";')]),
    assistant(use('t2', 'Edit', { file_path: '/p/cart.ts', old_string: 'red', new_string: 'green' })),
    user([result('t2', 'ok')]),
    { type: 'attachment', attachment: { type: 'queued_command', origin: { kind: 'human' }, prompt: 'and the cancel one gray' } },
    { type: 'attachment', attachment: { type: 'queued_command', origin: { kind: 'task-notification' }, prompt: 'a background task ended' } },
    { type: 'attachment', attachment: { type: 'hook_success', hookEvent: 'SessionStart', content: 'Kulisa profiles open now' } },
    assistant(use('t3', 'Bash', { command: 'npm test', description: 'tests' })),
    user([result('t3', long)]),
    assistant(use('t4', 'Bash', { command: 'npm run lint' })),
    user([result('t4', [{ type: 'text', text: 'lint: 3 errors' }], true)]),
    user('This session is being continued from a previous conversation. Summary: buttons recolored.', { isCompactSummary: true }),
    assistant(use('t5', 'TodoWrite', { todos: [{ content: 'pay green', status: 'completed' }, { content: 'cancel gray', status: 'in_progress' }] })),
    user([result('t5', 'Todos updated')]),
    assistant(use('t6', 'mcp__kulisa__task_history', { part: 1 })),
    user([result('t6', 'Part 1 of 1. The history …')]),
    user([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'xx' } }, { type: 'text', text: 'like this' }]),
    assistant({ type: 'text', text: 'Done: both recolored.' }),
    { type: 'file-history-snapshot', snapshot: {} },
  ]);
  fs.mkdirSync(path.join(root, 'claude', 'memory'));
  fs.writeFileSync(path.join(root, 'claude', 'memory', 'MEMORY.md'), '- [Colors](colors.md)');
  fs.writeFileSync(path.join(root, 'claude', 'memory', 'colors.md'), 'Buttons take their color from tokens.css.');
  const c = claudeConversation(file);
  assert.deepEqual(c.entries.map((e) => e.kind), ['human', 'agent', 'call', 'call', 'result', 'human', 'call', 'result', 'call', 'error', 'summary', 'result', 'human', 'agent']);
  const t = c.entries.map((e) => e.text);
  assert.equal(t[0], 'Make the pay button green');
  assert.equal(t[2], 'Read /p/cart.ts', "a file read by its path: its content is left out, its result too");
  assert.equal(t[3], 'Edit /p/cart.ts\n--- old\nred\n--- new\ngreen');
  assert.equal(t[5], 'and the cancel one gray', 'typed while the agent worked: the human\'s; a task\'s notice is not');
  assert.equal(t[6], 'Bash: npm test');
  assert.match(t[7], /^a{2048}\n… \[10000 characters cut\] …\nz{2048}$/, 'a long output: its start and end');
  assert.equal(t[9], 'lint: 3 errors', 'an error whole');
  assert.match(t[10], /^This session is being continued/);
  assert.equal(t[12], 'like this', 'the picture left out');
  assert.ok(!t.some((x) => /secret|Kulisa profiles open now|task_history|Part 1 of 1|permission/.test(x)), 'reasoning, hooks, its own history and the CLI\'s records left out');
  assert.equal(c.plan, '[completed] pay green\n[in_progress] cancel gray', 'the last plan');
  assert.equal(c.stopped, null, 'the last turn ended');
  assert.match(c.memory, /^### MEMORY\.md\n- \[Colors\]\(colors\.md\)\n\n### colors\.md\nButtons take their color/, 'its memory, the index first');
});

test('history: where a Claude Code turn stopped: a call with no result, or the human unanswered', () => {
  const cutOff = claudeConversation(write('cut', [user('run the tests'), assistant(use('t1', 'Bash', { command: 'npm test' }))]));
  assert.equal(cutOff.stopped, 'its last turn was cut off while it ran Bash, with no result');
  assert.equal(cutOff.memory, null, 'no memory folder');
  const unanswered = claudeConversation(write('unanswered', [user('hi'), assistant({ type: 'text', text: 'hello' }), user('now the cart')]));
  assert.equal(unanswered.stopped, "the human's last message got no answer");
});

// A record of each kind Codex 0.160.1 writes (docs/transcripts.md: the reader's table).
const item = (payload: object) => ({ type: 'response_item', payload });
const said = (role: string, text: string) => item({ type: 'message', role, content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text }] });
const script = (id: string, input: string) => item({ type: 'custom_tool_call', name: 'exec', call_id: id, input, status: 'completed' });
const printed = (id: string, text: string) => item({ type: 'custom_tool_call_output', call_id: id, output: [{ type: 'input_text', text: 'Script completed\n' }, { type: 'input_text', text }] });
const event = (payload: object) => ({ type: 'event_msg', payload });

test("history: a Codex transcript gives the human's words, the agent's answers, its scripts and what they printed, a mark where it compacted", () => {
  const long = `${'a'.repeat(CUT)}${'m'.repeat(10_000)}${'z'.repeat(CUT)}`;
  const c = codexConversation(write('codex', [
    { type: 'session_meta', payload: { id: 's1', cwd: '/p@task-2' } },
    said('developer', 'Kulisa profiles are the only browser here'),
    said('user', '<environment_context>\n  <cwd>/p@task-2</cwd>\n</environment_context>'),
    said('user', '# AGENTS.md instructions for /p@task-2\n…'),
    said('user', 'Make the pay button green'),
    event({ type: 'item_completed', item: { type: 'UserMessage', content: [{ type: 'text', text: 'Make the pay button green' }] } }),
    said('assistant', 'Looking at the cart.'),
    item({ type: 'reasoning', summary: [], encrypted_content: 'gAAAA-secret' }),
    script('c1', 'text(await tools.exec_command({cmd: "npm test"}))'),
    printed('c1', long),
    item({ type: 'custom_tool_call', name: 'apply_patch', call_id: 'c2', input: '*** Begin Patch\n*** Update File: cart.ts\n-red\n+green\n*** End Patch' }),
    item({ type: 'custom_tool_call_output', call_id: 'c2', output: 'Success.' }),
    item({ type: 'function_call', name: 'update_plan', call_id: 'c3', arguments: JSON.stringify({ plan: [{ step: 'pay green', status: 'completed' }, { step: 'cancel gray', status: 'in_progress' }] }) }),
    item({ type: 'function_call_output', call_id: 'c3', output: 'Plan updated' }),
    script('c4', 'const ts = ALL_TOOLS.filter((x) => /task_history/.test(x.name)); text(JSON.stringify(ts))'),
    printed('c4', '[{"name":"mcp__kulisa__task_history"}]'),
    script('c5', 'text(await tools.mcp__kulisa__task_history({ part: 1 }))'),
    printed('c5', 'Part 1 of 1. The history …'),
    event({ type: 'item_completed', item: { type: 'McpToolCall', server: 'kulisa', tool: 'task_history', result: 'Part 1 of 1' } }),
    { type: 'token_usage_record', payload: { usage: {} } },
    { type: 'compacted', payload: { message: '', replacement_history: [{ type: 'compaction', encrypted_content: 'gAAAA' }] } },
    said('user', 'and the cancel one gray'),
    item({ type: 'function_call', name: 'wait', call_id: 'c6', arguments: '{"cell_id":"7"}' }),
    item({ type: 'function_call_output', call_id: 'c6', output: [{ type: 'input_text', text: 'Script completed' }] }),
    said('assistant', 'Done: both recolored.'),
  ]));
  assert.deepEqual(c.entries.map((e) => e.kind), ['human', 'agent', 'call', 'result', 'call', 'result', 'summary', 'human', 'call', 'result', 'agent']);
  const t = c.entries.map((e) => e.text);
  assert.equal(t[0], 'Make the pay button green', "Codex's environment and the project's AGENTS.md are not the human's");
  assert.equal(t[2], 'exec: text(await tools.exec_command({cmd: "npm test"}))', 'a call is the script it ran');
  assert.match(t[3], /^Script completed\na{2031}\n… \[\d+ characters cut\] …\nz{2048}$/, 'what it printed, its start and end');
  assert.match(t[4], /^apply_patch: \*\*\* Begin Patch/, 'an edit whole');
  assert.match(t[6], /encrypted/, 'a chapter starts where it compacted, its summary not readable');
  assert.equal(t[8], 'wait: {"cell_id":"7"}');
  assert.ok(!t.some((x) => /secret|only browser|task_history|Part 1 of 1|Plan updated/.test(x)), 'reasoning, its instructions, its own history and the plan\'s call left out');
  assert.equal(c.plan, '[completed] pay green\n[in_progress] cancel gray', 'the last plan');
  assert.equal(c.stopped, null);
  assert.equal(c.memory, null);
});

test('history: where a Codex turn stopped: interrupted, a call with no result, or the human unanswered', () => {
  const interrupted = codexConversation(write('codex-esc', [said('user', 'hi'), said('assistant', 'hello'), said('user', 'write an essay'),
    said('developer', '<turn_aborted>\nThe previous turn was interrupted on purpose.'), event({ type: 'turn_aborted', reason: 'interrupted' })]));
  assert.equal(interrupted.stopped, 'the human interrupted its last turn');
  assert.equal(codexConversation(write('codex-cut', [said('user', 'run the tests'), script('c1', 'text(await tools.exec_command({cmd: "npm test"}))')])).stopped,
    'its last turn was cut off while it ran exec, with no result');
  assert.equal(codexConversation(write('codex-unanswered', [said('user', 'hi'), said('assistant', 'hello'), said('user', 'now the cart')])).stopped,
    "the human's last message got no answer");
});

// The main process's ends of the windows' channels, checked against their table (src/shared/ipc.ts; docs/window.md,
// IPC). The window's ends: renderer/env.d.ts. Electron's objects from the module, not by name: a unit test loads what
// imports this (a Kulisa package's main half: docs/testing.md).
import electron from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import type { Invoke, Send } from '../shared/ipc.ts';
import type { Shell } from './shell.ts';
import type { AppWindow } from './window.ts';
import type { OpenTasks } from './open-tasks.ts';
import { bare, log, summary } from './log.ts';

// Every channel is logged with who sent it (log.ts), but these: the terminal's keystrokes and size (never: what is typed),
// and what comes on every change, draw or hover (the grid's boxes, layouts, lists read again, the paths under the pointer), which would fill the log with
// nothing; and Settings shown and left, which say so in lines of their own (app.ts, openSettings; ipc/window.ts). An
// answer to a question is logged without the answer: it may be anything the human typed.
const QUIET = new Set<string>(['pty:in', 'pty:resize', 'pty:quote-paths', 'terminal:files', 'layout:apply', 'layout:save', 'layout:load', 'views:hidden', 'keys:zone', 'zoom:get', 'voice:get', 'voice:record',
  'language:get', 'project:refresh', 'project:list', 'account:list', 'profiles:list', 'agent:list', 'settings:open', 'settings:close', 'github:account:list', 'project:github:get']);
const BARE = new Set<string>(['ask:answer']);
function line(channel: string, e: IpcEvent, args: unknown[]) {
  if (QUIET.has(channel)) return;
  const what = BARE.has(channel) || !args.length ? '' : ` ${summary(args.length === 1 ? args[0] : args)}`;
  log.info(`[ipc] ${channel} wc=${e.sender.id}${what}`);
}

// An answer the window does not read (`void`) may be anything; one it reads is the table's.
type Answer<R> = [R] extends [void] ? unknown : R | Promise<R>;

export function handle<C extends keyof Invoke>(channel: C, fn: (e: IpcMainInvokeEvent, ...args: Invoke[C]['args']) => Answer<Invoke[C]['result']>) {
  electron.ipcMain.handle(channel, async (e: IpcMainInvokeEvent, ...args: unknown[]) => {
    line(channel, e, args);
    const r = await (fn as (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown)(e, ...args);
    const error = (r as { error?: unknown } | null)?.error;
    if (error) log.info(`[ipc] ${channel} refused: ${bare(String(error))}`);
    return r;
  });
}

export function on<C extends keyof Send>(channel: C, fn: (e: IpcMainEvent, arg: Send[C]) => void) {
  electron.ipcMain.on(channel, (e, arg) => { line(channel, e, [arg]); fn(e, arg); });
}

export type IpcEvent = IpcMainEvent | IpcMainInvokeEvent;

// What the windows' handles (ipc/) get: the app, the window a message comes from (at: where its questions are asked
// too), the open tasks (open-tasks.ts) and their one-after-another.
export interface Ipc {
  shell: Shell;
  at: (e: IpcEvent) => AppWindow | null;
  tasks: OpenTasks;
  serial: OpenTasks['serial'];
}

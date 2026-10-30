// The task's application terminal environments: saved launch setup, explicit processes, shared human/agent actions.
import { startTerminal, stopTerminal, forgetTerminal, terminalScreen, setTerminalSize, pressTerminalKey, pasteTerminal } from '../terminal/main/index.ts';
import type { Pty } from '../terminal/main/index.ts';
import { TERMINAL_LINES, validTerminalSize } from '../shared/application-terminal.ts';
import type { ApplicationConfig, ApplicationKey, ApplicationTerminal, ApplicationScreen, TerminalSize } from '../shared/application-terminal.ts';
import type { Result } from '../shared/result.ts';
import { labelError } from '../shared/names.ts';
import { log } from './log.ts';
import type { Task } from './tasks.ts';

type Application = ApplicationTerminal & { pty?: Pty; pending?: Promise<Result<ApplicationTerminal>> };
export class ApplicationTerminals {
  private list = new Map<number, Application>();
  private seq = 0;
  private task: Task;
  constructor(task: Task) {
    this.task = task;
    const saved = task.store.applications();
    this.seq = saved.next - 1;
    for (const c of saved.list) {
      if (!c || !Number.isSafeInteger(c.id) || c.id < 1 || labelError(c.name) || typeof c.command !== 'string' || c.command.length > 8192 || c.size && !validTerminalSize(c.size)) continue;
      if (this.list.has(c.id) || [...this.list.values()].some((a) => a.name.toLowerCase() === c.name.toLowerCase())) continue;
      this.seq = Math.max(this.seq, c.id);
      this.list.set(c.id, this.make(c));
    }
  }
  private make(c: ApplicationConfig): Application {
    return { ...c, size: c.size || null, key: `${this.task.key}#app-${c.id}`, status: 'stopped', exitCode: null };
  }
  info(): ApplicationTerminal[] { return [...this.list.values()].map(({ id, name, command, size, key, status, exitCode }) => ({ id, name, command, size, key, status, exitCode })); }
  private changed(save = false) {
    if (save) this.task.store.saveApplications({ next: this.seq + 1, list: this.info().map(({ id, name, command, size }) => ({ id, name, command, size })) });
    if (this.task.shown()) this.task.window?.send('applications', { task: this.task.key, list: this.info() });
  }
  private find(which: number | string): Application | { error: string } {
    const app = typeof which === 'number' ? this.list.get(which) : [...this.list.values()].find((a) => a.name.toLowerCase() === which.trim().toLowerCase());
    return app || { error: `No application terminal "${which}". Open: ${this.info().map((a) => a.name).join(', ') || 'none'}. Run a command in a named terminal first.` };
  }
  create(name?: string, command = '', size: TerminalSize | null = null): Result<ApplicationTerminal> {
    if (!this.task.loaded) return { error: 'The task is not open.' };
    name = name?.trim();
    if (!name) for (let n = 1; !name; n++) { const candidate = `Application ${n}`; if ('error' in this.find(candidate)) name = candidate; }
    const bad = labelError(name);
    if (bad) return { error: bad };
    if (!('error' in this.find(name))) return { error: `An application terminal "${name}" already exists.` };
    if (command.length > 8192) return { error: 'A launch command may have at most 8192 characters.' };
    if (size && !validTerminalSize(size)) return { error: 'Terminal size must be 2–500 columns and 2–200 rows.' };
    const app = this.make({ id: ++this.seq, name, command, size });
    this.list.set(app.id, app);
    log.info(`[application] ${app.key} created`);
    this.changed(true);
    return this.snapshot(app);
  }
  private snapshot(app: Application): ApplicationTerminal { return this.info().find((a) => a.id === app.id)!; }
  configure(which: number | string, change: { name?: string; command?: string; size?: TerminalSize | null }): Result<ApplicationTerminal> {
    const a = this.find(which); if ('error' in a) return a;
    const name = change.name?.trim() ?? a.name, bad = labelError(name);
    if (bad) return { error: bad };
    if ([...this.list.values()].some((b) => b !== a && b.name.toLowerCase() === name.toLowerCase())) return { error: `An application terminal "${name}" already exists.` };
    if (change.command !== undefined && change.command.length > 8192) return { error: 'A launch command may have at most 8192 characters.' };
    if (change.size && !validTerminalSize(change.size)) return { error: 'Terminal size must be 2–500 columns and 2–200 rows.' };
    Object.assign(a, change, { name });
    if (change.size !== undefined) setTerminalSize(a.key, change.size);
    log.info(`[application] ${a.key} configured`);
    this.changed(true);
    return this.snapshot(a);
  }
  private async start(which: number): Promise<Result<ApplicationTerminal>> {
    const a = this.find(which); if ('error' in a) return a;
    if (!this.task.loaded) return { error: 'The task is not open.' };
    if (a.status === 'running' || a.pending) return { error: 'The application is running or starting. Stop or restart it first.' };
    if (!a.command.trim()) return { error: 'Set a launch command before starting the application.' };
    // A fresh buffer per run; an exited program's final screen remains readable until the next run.
    if (a.pty) stopTerminal(a.pty);
    a.pty = undefined;
    this.task.window?.send('terminals:gone', [a.key]);
    a.status = 'starting'; a.exitCode = null;
    log.info(`[application] ${a.key} starting`);
    this.changed();
    const launch = this.launch(a);
    a.pending = launch;
    try { return await launch; } finally { if (a.pending === launch) a.pending = undefined; }
  }
  private async launch(a: Application): Promise<Result<ApplicationTerminal>> {
    try {
      setTerminalSize(a.key, a.size);
      const p = await startTerminal((channel, data) => this.task.window?.send(channel, data),
        { execute: a.command, cwd: this.task.folder, env: this.task.env(), size: a.size || { cols: 80, rows: 24 }, screen: TERMINAL_LINES }, a.key);
      if (this.list.get(a.id) !== a || a.status !== 'starting' || !this.task.loaded) { stopTerminal(p); return { error: 'The application was stopped or closed while starting.' }; }
      a.pty = p;
      p.onExit(({ exitCode }) => {
        if (a.pty !== p || p.stopped) return;
        a.status = 'exited'; a.exitCode = exitCode;
        this.changed();
      });
      await p.typed;
      if (a.pty !== p || p.stopped || !this.task.loaded) return { error: 'The application was stopped or closed while starting.' };
      if (a.status === 'starting') a.status = 'running';
      log.info(`[application] ${a.key} started`);
      this.changed();
      return this.snapshot(a);
    } catch (e) {
      a.status = 'stopped';
      this.changed();
      return { error: `Could not start application: ${(e as Error).message}` };
    }
  }
  stop(which: number | string): Result<ApplicationTerminal> {
    const a = this.find(which); if ('error' in a) return a;
    if (a.pty) stopTerminal(a.pty, { keepScreen: true });
    a.status = 'stopped'; a.exitCode = null;
    log.info(`[application] ${a.key} stopped`);
    this.changed();
    return this.snapshot(a);
  }
  async run(which: number | string, command?: string, size?: TerminalSize | null): Promise<Result<ApplicationTerminal>> {
    if (!this.task.loaded) return { error: 'The task is not open.' };
    const found = this.find(which);
    if ('error' in found && typeof which === 'number') return found;
    if (!(command ?? ('error' in found ? '' : found.command)).trim()) return { error: 'Supply a command to run.' };
    const configured = 'error' in found ? this.create(String(which), command, size)
      : this.configure(found.id, { ...(command !== undefined && { command }), ...(size !== undefined && { size }) });
    if ('error' in configured) return configured;
    const a = this.list.get(configured.id)!, pending = a.pending;
    this.stop(a.id);
    if (pending) await pending;
    return this.start(a.id);
  }
  close(which: number | string): Result<{ id: number }> {
    const a = this.find(which); if ('error' in a) return a;
    this.stop(a.id);
    if (a.pty) stopTerminal(a.pty);
    a.pty = undefined; this.list.delete(a.id); forgetTerminal(a.key);
    this.task.window?.send('terminals:gone', [a.key]);
    log.info(`[application] ${a.key} closed`);
    this.changed(true);
    return { id: a.id };
  }
  async read(which: number | string, lines = 50, screenOnly = true): Promise<Result<ApplicationScreen>> {
    const a = this.find(which); if ('error' in a) return a;
    if (!Number.isInteger(lines) || lines < 1 || lines > TERMINAL_LINES) return { error: `Read 1–${TERMINAL_LINES} lines.` };
    const pty = a.pty;
    const text = pty ? await terminalScreen(pty, lines, screenOnly) : '';
    if (this.list.get(a.id) !== a || a.pty !== pty) return { error: 'The application changed while reading. Read it again.' };
    const screen = a.pty?.screen, buffer = screen?.buffer.active;
    return { terminal: this.snapshot(a), text, size: screen ? { cols: screen.cols, rows: screen.rows } : null,
      cursor: buffer ? { column: buffer.cursorX + 1, row: buffer.cursorY + 1 } : null };
  }
  input(which: number | string, input: { text?: string; paste?: boolean; key?: ApplicationKey }): Result<{ id: number }> {
    const a = this.find(which); if ('error' in a) return a;
    if (!a.pty || a.status !== 'running') return { error: 'The application is not running. Start it first.' };
    if (input.text !== undefined && input.key !== undefined) return { error: 'Send text or one key per call.' };
    if (input.text !== undefined) {
      if (input.text.length > 16384) return { error: 'Send at most 16384 characters per call.' };
      pasteTerminal(a.pty, input.text, !!input.paste);
    } else if (!input.key || !pressTerminalKey(a.pty, input.key)) return { error: 'Supply text or a supported key.' };
    log.info(`[application] ${a.key} input`);
    return { id: a.id };
  }
  unload() {
    for (const a of this.list.values()) { this.stop(a.id); if (a.pty) stopTerminal(a.pty); a.pty = undefined; forgetTerminal(a.key); }
  }
}

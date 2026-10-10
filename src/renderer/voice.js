// Dictation (docs/window.md, Terminal): where the shown task's agent has its own (agents.js, voice), the
// terminal's header shows the language it hears and a microphone. The agent records and turns speech into text; Kulisa
// only holds its key (Task.dictate), so nobody has to know the agent's command or key. The microphone works as a
// voice message's button: held, it records until let go; a click starts, another click stops. The text goes where
// the cursor is in the agent's input, after what is there, to read and send. Lit while it records.
//   showDictation(task)   the controls for that task's agent (showTerminal)
const showDictation = (() => {
  const box = termTab.querySelector('.dictation'), lang = box.querySelector('.lang'), mic = box.querySelector('.mic');
  const known = new Map(); // task key -> { languages, language, note, recording } or null (no dictation)
  let shown = null;
  const name = (code, inLanguage = code) => new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code);
  const render = () => {
    const v = known.get(shown);
    box.hidden = !v;
    if (!v) return;
    lang.textContent = v.language.toUpperCase();
    lang.title = `Dictation in ${name(v.language, 'en')}: the language you speak${v.note ? `. ${v.note}` : ''}`;
    mic.title = v.recording ? 'Recording: click to stop' : 'Speak to the agent: hold, or click to start and again to stop';
    mic.ariaPressed = String(v.recording);
  };
  kulisa.on('voice', ({ task, voice }) => { known.set(task, voice); if (task === shown) render(); });

  const record = async (task, on) => {
    const v = known.get(task);
    if (!v) return;
    v.recording = on; // at once, as the button is pressed
    if (task === shown) render();
    v.recording = (await kulisa.invoke('voice:record', { task, on })).recording;
    if (task === shown) render();
  };
  // The panel is not dragged by its header from here.
  box.addEventListener('dragstart', (e) => e.preventDefault());
  let down = 0; // when the press that started a recording began
  mic.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault(); // the keyboard stays in the terminal
    try { mic.setPointerCapture(e.pointerId); } catch {} // let go anywhere
    if (known.get(shown)?.recording) { down = 0; record(shown, false); } // the second click
    else { down = e.timeStamp; record(shown, true); }
  });
  const up = (e) => {
    if (down && e.timeStamp - down > 400) record(shown, false); // held; a click leaves it on until the next
    down = 0;
    term?.focus();
  };
  mic.addEventListener('pointerup', up);
  mic.addEventListener('pointercancel', up);
  mic.addEventListener('click', (e) => { if (!e.detail) record(shown, !known.get(shown)?.recording); }); // Enter or Space on it

  // The languages the agent understands: the system's first, then by name in each language itself.
  lang.onclick = () => {
    const v = known.get(shown), task = shown;
    if (!v) return;
    const system = navigator.language.split('-')[0];
    const order = v.languages.toSorted((a, b) => (b === system) - (a === system) || name(a).localeCompare(name(b)));
    openMenu([{ heading: 'Dictation language' }, ...order.map((code) => ({
      label: name(code), sub: name(code, 'en') === name(code) ? '' : name(code, 'en'), icon: code === v.language ? 'i-done' : undefined,
      run: async () => {
        const r = await kulisa.invoke('voice:language', { task, code });
        if (r?.error) return (await import('./ask.js')).ask({ message: 'The language was not changed', detail: r.error });
        const now = known.get(task); // as it is now: recording may have changed meanwhile
        if (now) now.language = r.language;
        if (shown === task) render();
      },
    }))], lang);
  };

  return async (task) => {
    if (shown !== task && known.get(shown)?.recording) record(shown, false); // not left on in a task out of sight
    shown = task;
    render();
    const v = await kulisa.invoke('voice:get', task);
    known.set(task, v);
    if (shown === task) render();
  };
})();

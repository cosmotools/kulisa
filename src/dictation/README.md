# Dictation

Speaking to the agent instead of typing: a Kulisa package (`docs/packages.md`). All of the dictation is here; Kulisa
tells it facts and draws its microphone, and the human never needs to know how the words were recognized.

Who uses it, and what it knows nothing of: a task (`src/main/tasks.ts`) tells it the agent in front of the task (its
name, its own dictation's key, its terminal, how text is put into its input), the dictation's key pressed and let go
(`Task.holdKey`, from the window's key, `shortcuts.ts`), the task gone (`Task.unload`); the window (`window.ts`) tells it the window lost the keyboard.
Which agent the key speaks to (with a shell in front, the agent the prompt goes to comes to the front first) is the
task's. The key itself, which one it is and how the human changes it, is the window's (`docs/window.md`, The terminal).

## Recording

The first way there is for the agent in front, the same key and microphone for every one:

1. **The agent's own dictation** (below).
2. **The hidden session**, for an agent without (Codex): another agent's dictation recognizing for it (For an agent
   without dictation, below).
3. **None**: the microphone disabled, its tooltip saying why.

A way that fails while used gives way to the next one down (an account to the next account, the last to none),
with a line in the log.

**The agent's own dictation** (Claude Code's voice mode: `docs/tasks.md`, "Choosing the agent"): the agent records and
recognizes, and the package holds its key in its terminal: the key typed again and again at the agent's repeat (a
keyboard's), as a terminal shows a held key (a terminal tells no key's release). The text goes
where the cursor is in the agent's input, after what is there, so several sentences can be dictated one after another,
and is left there to read and send (recognition makes mistakes, and a task misheard costs more than a key).

Held (longer than 400 ms), the key records until it is let go; pressed once, until the next press, or 5 minutes, a
recording left on. Another agent brought to the front, its terminal started again, the window losing the keyboard
with the key down, or the task closing stops it too: a recording never goes on where the human does not see it.

A task's microphone is in one of five states (`Voice`): **none** (disabled, with why: a shell in front, an agent
without dictation of its own and no account to recognize for it), **ready**, **starting** (the hidden session getting
ready to listen), **recording**, **transcribing** (let go, the text on its way into the input of the agent it names).
Transcribing lasts, for the hidden session, until its text comes (at most 6 s); the agent's own dictation tells no end,
so for it about as long as Claude Code's takes (0.8 s). A recording stopped by anything but the human (another agent in
front, the task closed) is not transcribed: its text goes nowhere. Each change is sent to the window that shows the
task (`send`, given by the caller).

## For an agent without dictation

`main/hidden.ts`: an agent's own dictation in a terminal no one sees, recognizing for the agent in front. Which
account and how it starts is the caller's (`Recognizer`; `src/main/recognizer.ts`: the first account, in Settings →
Agents' order, of an agent whose entry has a `recognizer` and whose sign-in gives it, Claude Code's with a Claude.ai
sign-in; its settings and keys are its entry's, `src/kulisa-plugin/main/agents/claude.ts`). The package starts it, holds its key and
gets its text, knowing no agent by name.

- **One session for the whole of Kulisa**, started at the first dictation (~1 s; the microphone **starting** until it
  listens: it records from the microphone itself, so words before that are lost), ended after 10 minutes
  without one (~190 MB let go). Not one a task: every task and window dictates through it, one language for every
  account. In a pty of its own (`node-pty`), a child of Kulisa's main process; its screen read by a headless xterm:
  its prompt drawn (started), "listening" (it hears), the words heard so far (below).
- **The text comes by its hook, not off its screen**: it runs in hold mode with `autoSubmit`, so the text is submitted
  when the key is let go, and its `UserPromptSubmit` hook posts it to Kulisa (`<server>/dictation/hooks/prompt`,
  `agent-hooks.ts`), whose answer blocks it: its model never gets it, and it costs no tokens. The text goes into the
  input of the agent it was spoken to while that one is still in front (else it is dropped), as a paste, left there to
  read and send.
- **The words as they are heard**: while it records, its input shows what it has heard so far (grey, a word or two
  every half second, its level meter after them), and these words go into the agent's input as they come, as in its
  own; the text from its hook then corrects them (punctuation and case change at the end). Each time only what changed
  is erased (Backspace) and typed again. Its screen is read for them as a cell's look tells: its placeholder in an
  empty input is dim, its level meter block glyphs; neither is a word. Read wrong after a change of Claude Code's
  screen, the text from its hook still puts the input right; read not at all, the text comes whole.
- **Its input emptied before each dictation**: a blocked prompt is put back in it. Its screen is wide, so its input is
  one line, which its clear key deletes (three times, to be sure).
- **A short one** (under three words, which `autoSubmit` does not send) stays in its input: a second after the key is
  let go with no text come, its submit key sends it.
- **When it fails** (it does not start, shows no prompt in 15 s, or does not listen 5 s after its key): the next
  account; none left, the microphone is **none**, saying why, until its 10 minutes are over and it is tried again.
- **Nothing piles up**: it runs in a folder of Kulisa's (`dictation/` in the data folder, trusted as a task's folder);
  once it has exited (ended, or when Kulisa quits), what its account keeps of that folder (its conversation, which
  holds what was said; its trust) goes with the folder, and at the next start when Kulisa did not end it (a crash).

## The microphone

`Dictation.tsx`, at the end of the terminals' row of tabs (the terminals' pane places it): the key's indicator, and the
way by the mouse. Its tooltip names the key and the language the agent hears (Kulisa's one, ☰ → Language); getting
ready (once slow, below) it is lit in the main button's color, while it records red, a ring pinging out of it (not with reduced
motion), so the eye catches from across the window that the agent is listening. It works as a voice message's button too: held, or a click to start and another to
stop; let go, the keyboard goes back to the terminal (`onDone`). Disabled when the task's dictation is none, its tooltip
saying why: a button that came and went would resize the terminal, and Claude Code redraws badly after one. The window
gives it the task shown, the key's name and the language.

Starting is drawn as such (the microphone lit, not red yet, the pill's Getting ready…) only once it has lasted 300 ms
(`renderer/voice.ts`, `slow`): the hidden session mostly listens in a fifth of a second, and a flash of it before every
recording reads as a glitch; until then it is drawn as recording.

## The pill

`Pill.tsx`, over the top of the terminal, in its middle (the terminals' pane places it): what the dictation does, so it is
seen where the eye is, not only at the row's end. Over the terminal, not above it: the terminal keeps its size (Claude
Code redraws badly after a resize), and the pointer goes through it. It springs in as a recording starts and grows or
shrinks to what it says:

- **Getting ready…** (starting, once slow): a spinner.
- **Listening** (recording): a pinging red dot, the voice as a live wave, the time spoken. The wave is the window's own
  reading of the microphone (`getUserMedia`, its level only, nothing kept or sent), while it records: the agent hears
  through its own program, which shows nothing outside its terminal. No microphone to read, the wave stays flat; the
  dictation goes on.
- **Transcribing…** (transcribing): a wave running through the bars.
- **In <agent>'s input**: transcribing ended with the task's agent unchanged; a check, the done green, for 1.6 s, then
  it goes.

With reduced motion, no spring, ping or wave running; the heard wave stays, being what is heard. Its check icon is the
caller's (`children`).

## Its channels

`ipc.ts`: `voice:get` (a task's microphone, read as the task is shown), `voice:record` (the microphone's click or
press), `voice` (a task's microphone changed).

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process half's entry: `Dictation`, `installDictation` (its channels) |
| `main/dictation.ts` | every task's dictation: its state, the key, recording by the first way there is |
| `main/hidden.ts` | the hidden session recognizing for an agent without dictation |
| `renderer/index.ts` | the window half's entry: `Dictation` (the microphone), `Pill` |
| `renderer/Dictation.tsx` | the microphone |
| `renderer/Pill.tsx` | the pill |
| `renderer/voice.ts` | each task's microphone as the main process tells it, starting once slow, the text just put in |
| `ipc.ts` | its channels |
| `dictation.test.ts` | unit tests: the hidden session against a fake recognizer and program |

Its e2e tests: `test/e2e/agents.spec.ts` ("dictation: an agent without its own …": the hidden session with the fake
agent's recognizer, `test/fixtures/fake-recognizer.mjs`, by the microphone) and `test/e2e/window.spec.ts` ("terminal:
dictation …"): the key held in a page and in the window, pressed once, the window losing the keyboard, the microphone by the mouse, a shell in front, the key changed; the fake agent shows
the key typed (`test/e2e/app.ts`).

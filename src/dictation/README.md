# Dictation

Speaking to the agent instead of typing: a Kulisa package (`docs/packages.md`). All of the dictation is here; Kulisa
tells it facts and draws its microphone, and the human never needs to know how the words were recognized.

Who uses it, and what it knows nothing of: a task (`src/main/tasks.ts`) tells it the agent in front of the task (its
name, its own dictation's key, its terminal), the dictation's key pressed and let go (`Task.holdKey`, from the window's
key, `shortcuts.ts`), the task gone (`Task.unload`); the window (`window.ts`) tells it the window lost the keyboard.
Which agent the key speaks to (with a shell in front, the agent the prompt goes to comes to the front first) is the
task's. The key itself, which one it is and how the human changes it, is the window's (`docs/window.md`, The terminal).

## Recording

Today the one way is **the agent's own dictation** (Claude Code's voice mode: `docs/tasks.md`, "Choosing the agent"):
the agent records and recognizes, and the package holds its key in its terminal: the key typed again and again at
the agent's repeat (a keyboard's), as a terminal shows a held key (a terminal tells no key's release). The text goes
where the cursor is in the agent's input, after what is there, so several sentences can be dictated one after another,
and is left there to read and send (recognition makes mistakes, and a task misheard costs more than a key).

Held (longer than 400 ms), the key records until it is let go; pressed once, until the next press, or 5 minutes, a
recording left on. Another agent brought to the front, its terminal started again, the window losing the keyboard
with the key down, or the task closing stops it too: a recording never goes on where the human does not see it.

A task's microphone is in one of three states (`Voice`): **none** (disabled, with why: a shell in front, an agent
without dictation of its own), **ready**, **recording**. Each change is sent to the window that shows the task
(`send`, given by the caller).

## The microphone

`Dictation.vue`, at the end of the terminals' row of tabs (`TerminalTabs.vue` places it): the key's indicator, and the
way by the mouse. Its tooltip names the key and the language the agent hears (Kulisa's one, ☰ → Language); while it
records it is red and breathes with a ring (`mic-breathe`; not with reduced motion), so the eye catches from across the
window that the agent is listening. It works as a voice message's button too: held, or a click to start and another to
stop; let go, the keyboard goes back to the terminal (`done`). Disabled when the task's dictation is none, its tooltip
saying why: a button that came and went would resize the terminal, and Claude Code redraws badly after one. The window
gives it the task shown, the key's name, the language and its icon (the window's sprite, as its slot).

## Its channels

`ipc.ts`: `voice:get` (a task's microphone, read as the task is shown), `voice:record` (the microphone's click or
press), `voice` (a task's microphone changed).

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process half's entry: `Dictation`, `installDictation` (its channels) |
| `main/dictation.ts` | every task's dictation: its state, the key, recording |
| `renderer/index.ts` | the window half's entry: `Dictation` (the microphone) |
| `renderer/Dictation.vue` | the microphone |
| `renderer/voice.ts` | each task's microphone as the main process tells it |
| `ipc.ts` | its channels |

Its e2e test is in `test/window.ts` ("terminal: dictation …"): the key held in a page and in the window, pressed once,
the window losing the keyboard, the microphone by the mouse, a shell in front, the key changed; the fake agent shows
the key typed (`test/run.ts`).

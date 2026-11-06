# Dictation

Speech input, a [Kulisa package](../../docs/packages.md). Callers supply active-agent facts, terminal/key actions and
lifecycle events; the package records/transcribes and exposes UI state. Task selection belongs to `Task.holdKey`,
key configuration to the window, recognizer account/launch setup to `src/main/recognizer.ts` and CLI adapters.

## Recording

Choose the first available method: agent-native dictation, hidden recognizer session, or disabled with a reason.
Failures fall through to the next account/method and are logged without dictated text.

- Native dictation repeats its hold key into the agent's terminal, which cannot report key release.
- Hold longer than 400 ms to record until release; tap to toggle, with a five-minute cap.
- Stop on agent switch, terminal restart, task close, or focus loss while holding. Non-human stops discard text.
- Insert text at the input cursor and leave it unsent for review; successive sentences append there.
- `Voice` states: none, ready, starting, recording, transcribing. Hidden transcription waits for its hook up to 6 s;
  native dictation has no completion signal and uses a 0.8 s estimate. Send state to the task's window.

## For an agent without dictation

`main/hidden.ts` runs a caller-supplied `Recognizer`; it knows no agent names. Core chooses the first eligible
account in Settings order (Claude.ai-authenticated Claude Code supports recognition for Codex).
External configurations are eligible only if they already trust the recognizer's folder. Core reports missing
trust without starting an invisible prompt; it never grants trust or cleans external account files.

- One node-pty session for Kulisa, started on first dictation; a headless xterm reads readiness/live words. Release
  after ten idle minutes, freeing about 190 MB. All windows/tasks share it and Kulisa's recognition language.
- Wait for listening before recording; early speech is lost. Show starting while the session initializes.
- Hold mode with `autoSubmit` sends recognized text to its `UserPromptSubmit` hook at
  `<server>/dictation/hooks/prompt`. The hook blocks model submission; paste into the intended agent only if still
  active. This uses no model tokens.
- Parse live words from screen cell styling, ignoring the dim placeholder and level meter. Patch only changed
  suffixes with Backspace/text; the final hook corrects punctuation/case or supplies all text if parsing fails.
- Clear the wide, single-line recognizer input three times before recording because blocked prompts reappear.
  After short dictation (under three words), submit explicitly if no hook arrives within a second.
- Fail over if launch fails, no prompt appears in 15 s, or listening does not begin in 5 s. With no account left,
  disable until the idle timeout permits retry.
- Store the hidden session in the data folder's `dictation/`; remove its folder after exit or quit, and at next
  startup after a crash. Core removes conversation and trust only from Kulisa-owned configurations.

## The microphone

`Dictation.tsx` sits at a fixed position in the [Activity bar](../../docs/ui.md#workbench-terminology).
Tooltip names the key/language or disabled reason.
Hold or click to start/stop; return focus to the terminal via `onDone`. Use primary color for slow starting and red
with a ping while recording; reduced motion suppresses the ping.

`renderer/voice.ts` exposes starting only after 300 ms (`slow`), avoiding flashes for quick startup; before that,
render as recording.

## The pill

`Pill.tsx` overlays the terminal without resizing it or taking pointer input:

| State | Display |
|---|---|
| Slow starting | Getting ready… and spinner |
| Recording | Listening, red dot, elapsed time and live microphone wave |
| Transcribing | Transcribing… and moving wave |
| Completed with same agent | In <agent>'s input, caller's check icon, 1.6 s |

The renderer reads microphone levels via `getUserMedia` only while recording; it stores/sends no audio. A missing
meter leaves a flat wave without interrupting dictation. Reduced motion removes spring, ping and travelling wave,
keeping the actual level display.

## Its channels

`ipc.ts`: `voice:get`, `voice:record`, `voice:state` for initial state, mouse input and updates.

## The code

- Entries/contracts: `main/index.ts`, `renderer/index.ts`, `ipc.ts`.
- `main/dictation.ts` owns per-task recording/state/fallback; `main/hidden.ts` owns the shared hidden recognizer.
- `renderer/` owns microphone/pill and delayed starting/completion display; callers place them and supply task facts.
- `dictation.test.ts` uses a fake recognizer. E2e: `agents.spec.ts` for fallback recognition and `window.spec.ts` for
  hold/toggle, focus cancellation, shell/agent targeting and key rebinding; fixtures model recognizer/key output.

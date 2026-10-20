// GitHub's channels (README, Settings → GitHub), joined into all of them in src/shared/ipc.ts: the window's page (Settings)
// and the main process.
import type { Result } from '../shared/result.ts';

// An account as the window shows it: never its token. via: signed in with Kulisa App or a fine-grained token pasted;
// repos: what it reaches (owner/name), as GitHub said at its last look; ends: when its sign-in ends (ms; null: never,
// a token without an expiry); expired: signed out, Sign In Again; projects: the projects whose repositories it is for.
export interface GithubAccount {
  id: string; login: string; name: string | null; via: 'app' | 'token'; repos: string[]; ends: number | null; expired: boolean; projects: string[];
}
export interface GithubAccounts { accounts: GithubAccount[]; install: string } // install: where the App is put on repositories

// ipcRenderer.invoke / ipcMain.handle (args, the answer).
export interface GithubInvoke {
  'github:accounts': { args: []; result: GithubAccounts };
  'github:refresh': { args: []; result: GithubAccounts }; // looked at again on GitHub: what each reaches, signed out
  // Kulisa App's sign-in (the device flow): its code comes as github:code; answered once signed in, or { error } (null:
  // cancelled).
  'github:signin': { args: [{ key: string }]; result: Result<GithubAccounts, string | null> };
  'github:signin-cancel': { args: [{ key: string }]; result: void };
  'github:token': { args: [{ token: string }]; result: Result<GithubAccounts> }; // a fine-grained token pasted
  'github:delete': { args: [{ id: string }]; result: Result<GithubAccounts, string | null> }; // asked first; { error: null }: a no
}

// webContents.send / kulisa.on: the code to enter on GitHub (url), for the sign-in key; ends: when it expires (ms).
export interface GithubEvents {
  'github:code': { key: string; code: string; url: string; ends: number };
}

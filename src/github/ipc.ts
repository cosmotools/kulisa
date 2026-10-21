// GitHub's channels between Settings' page and the main process (README, The window), joined into all of them in
// src/shared/ipc.ts, what they answer, and the pages of GitHub's both halves name.
import type { Result } from '../shared/result.ts';

// GitHub's pages both halves name: where the human installs Kulisa App on an account (or asks its owner to), where a
// sign-in is revoked, where a fine-grained token is made.
export const INSTALL = 'https://github.com/apps/kulisa-app/installations/new';
export const REVOKE = { app: 'https://github.com/settings/apps/authorizations', pat: 'https://github.com/settings/personal-access-tokens' };
export const NEW_TOKEN = 'https://github.com/settings/personal-access-tokens/new';

// How an account signed in: Kulisa App's device flow, or a fine-grained token pasted.
export type GitHubKind = 'app' | 'pat';
// An account as Settings → GitHub lists it: who it is, where Kulisa App is installed (null: a token, which has no
// installations; or GitHub not reached), the projects that use it (their names), when its sign-in ends (ms; null:
// never, a token without an end), signed in or not (a refresh refused, a token ended, no keyring at the last start).
export interface GitHubAccount {
  id: string; login: string; kind: GitHubKind; installed: string[] | null; projects: string[]; ends: number | null; signedIn: boolean;
}
// kept: whether a sign-in outlives Kulisa's run (false: no keyring, README, The tokens).
export interface GitHubInfo { accounts: GitHubAccount[]; kept: boolean }
// What the human enters on GitHub's page (the device flow), and that page.
interface GitHubCode { code: string; url: string }

// What a repository's remote is to the accounts (a project's page: the window's channels, src/shared/ipc.ts): its
// account (bound, or the first that reaches it: suggested), its owner/repo, and its state: ok; not-github (not
// github.com, or an SSH alias ssh cannot name); not-reached (its account, or none of them, reaches it: Kulisa App not
// installed on its owner, or a token for another owner; install: where the App is installed); signed-out (its account,
// or every one); no-account (none at all); unreachable (GitHub not reached); why: what keeps it from its account, in
// words (null: nothing).
export type RepoState = 'ok' | 'not-github' | 'not-reached' | 'signed-out' | 'no-account' | 'unreachable';
export interface RepoGitHub { account: string | null; suggested: boolean; state: RepoState; owner: string | null; repo: string | null; install: string | null; why: string | null }

type I<A extends unknown[], R = void> = { args: A; result: R };
export interface GitHubInvoke {
  'github:accounts': I<[], GitHubInfo>;
  // The device flow, in three: a code asked of GitHub and shown; then waited for (GitHub's page opened), until the human
  // has entered it (the account, new or signed in again: id), denied it or it expired, or it was cancelled (null).
  // again: the account to sign in again.
  'github:signin': I<[{ again?: string | null }?], Result<GitHubCode>>;
  'github:signin-wait': I<[], Result<GitHubInfo & { id: string }, string | null>>;
  'github:signin-cancel': I<[]>;
  // A fine-grained token pasted: a new account, or (again) a new token for one.
  'github:token': I<[{ token: string; again?: string | null }], Result<GitHubInfo & { id: string }>>;
  // Deleted after a question (null: the human said no).
  'github:delete': I<[{ id: string }], Result<GitHubInfo, string | null>>;
}

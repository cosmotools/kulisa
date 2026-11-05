# GitHub

GitHub accounts and authentication, a [Kulisa package](../../docs/packages.md). Callers supply the data folder,
keyring, fetch and domain actions. Projects, tasks and window state stay outside. Agent tools are planned in #48;
tokens stay inside Kulisa.

## Why a GitHub App

[Kulisa App](https://github.com/apps/kulisa-app), owned by `cosmotools`, uses device flow and reaches only installed
repositories. Permissions: Contents read; Pull requests/Issues read-write; Checks, Commit statuses, Actions and
Metadata read. Actions appear under the human's account with the App's mark. A desktop app holds no client secret
or private key; its public client ID is in `main/api.ts`.

A fine-grained PAT supports organizations that decline App installation; owner approval may still be required.
It grants selected permissions for one owner's repositories. Reject classic `ghp_` tokens with broad access.
Kulisa neither imports nor blocks the agent's independent `gh` credentials.

## How it signs in (`main/github.ts`, `main/api.ts`)

- Device flow: request `/login/device/code`, display code/Copy and expiry, then open GitHub in the user's browser.
  Warn users to enter only a code Kulisa just displayed: public client IDs also permit attacker-started flows.
- Poll `/login/oauth/access_token` at GitHub's interval. `authorization_pending` retries; `slow_down` uses the supplied
  interval or adds 5 s; denial, expiry and Cancel end the flow. Keep one active flow.
- Access tokens last 8 hours, refresh tokens 6 months. Refresh shortly before expiry without a client secret.
  Serialize refreshes per account (`Accounts.refreshing`) because each rotates the pair. Atomically persist the new
  pair before use. A refused refresh signs out; network failure remains retryable. Quit between response and write
  can require another sign-in.
- `/user` identifies the login. PAT expiry comes from `github-authentication-token-expiration`; expired tokens sign out.
- Reauthentication preserves account ID/bindings and requires the same App login. Repeated App authorization reuses
  its account; PATs remain separate even for the same login because they may reach different owners.
- Use typed `@octokit/request` over Electron `net.fetch` for system proxies. REST supports conditional polling without
  loading every endpoint; device flow/secretless refresh live in `main/api.ts`. `KULISA_GITHUB` routes tests to fake
  GitHub with API under `/api`.

## The accounts (`main/accounts.ts`)

`github.json`: `{ list: [{ id, login, kind, secret }] }`, with six-character IDs, `kind` `app`/`pat`, and encrypted
secrets or none when signed out. Rewrite the file on changes. Log account ID/login and lifecycle/reasons, never
secrets, device codes or token-bearing URLs.

With no secure keyring (`safeStorage` backend `basic_text`), retain tokens only in memory and explain the session
limit in Settings. Deletion removes stored tokens and project bindings but cannot revoke GitHub authorization
without a client secret. The core's `deleteGitHub` question links human revocation:
[App authorizations](https://github.com/settings/apps/authorizations) or
[PATs](https://github.com/settings/personal-access-tokens).

## A repository's account

Core `remoteKey` (`remotes.ts`) normalizes origin to lowercase host/owner/repo, dropping scheme, user, token, port
and `.git`; SSH aliases resolve through `ssh -G`. `projects.json` binds
`github: { "github.com/acme/shop": "<account id>" }`, so bindings survive folder/computer changes.

Without a binding, suggest and bind the first account whose `GET /repos/{owner}/{repo}` succeeds; keep that choice
until changed by the human. Removing an account clears its bindings; removing a repository clears its binding
unless another repository has that remote. `GitHub.repo` and core `githubOf` supply shared failure reasons:
non-GitHub remote/unresolved alias, App not installed, inaccessible PAT, signed out, or network failure.

## The window

Settings → GitHub lists known logins, projects and authentication expiry immediately after a local read, then
loads installations (`/user/installations`) with a spinner beside each pending account's details.
Add offers App or token sign-in, replacing an active flow; delete asks first; context menu offers reauthentication
and deletion. Leaving a displayed device code cancels its flow.

Project repository rows show a named spinner during account lookup, then an account Select, and shared failure
messages below the list. Settings owns these pages, menus and questions.

## Its channels (`ipc.ts`)

`github:account:list` accepts `local: true` to skip installation requests; its default includes them.
`github:signin:start/wait/cancel/token`, `github:account:delete`; shared page constants:
`INSTALL`, `REVOKE`, `NEW_TOKEN`. Core owns project bindings through `project:github:get/set`
(`src/shared/ipc.ts`, `ipc/projects.ts`).

## The code

- `main/index.ts`, `ipc.ts`: entry, channels and shared GitHub page constants.
- `main/`: account persistence/serialized refresh, authentication/repository access and typed HTTP configuration.
- Core `remotes.ts` owns canonical remote keys; `projects.ts` owns bindings/deletion questions; `app.ts` supplies
  keyring/network/browser opening. Project IPC and Settings own repository selectors and account pages.
- `github.test.ts` uses fake fetch; `test/e2e/github.spec.ts` uses the fixture site's `/github`, including keyring
  persistence across restart.

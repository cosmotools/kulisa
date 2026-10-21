# GitHub

The human's GitHub accounts, signed in to Kulisa, several of them (work, personal), each until the human deletes it,
and which account each repository of a project goes as. A Kulisa package ([docs/packages.md](../../docs/packages.md)):
it knows nothing of projects, tasks or the window; the main process gives it its data folder, the OS keyring and a
fetch, and tells it what only the rest knows (which projects use an account, where a question is asked). Only GitHub,
not GitLab or another host: another would be a package of its own.

Kulisa holds the tokens; the agent never gets one. The agent reads pages strangers write (issues, comments, the
profiles' pages), and a token in its reach could be sent away by a text that tells it to: the same principle as a
test user's password (docs/profiles.md, "Test users' sign-ins"): the agent acts, Kulisa keeps the secret. The agent
has no tool of it yet: what is here is the sign-in and the accounts.

## Why a GitHub App

Kulisa App (https://github.com/apps/kulisa-app, owned by `cosmotools`) signs the human in with GitHub's device flow,
as an agent's own sign-in does (a code, the user's browser). Its token reaches only the repositories the App is
installed on, with only its permissions (Contents read; Pull requests and Issues read and write; Checks, Commit
statuses and Actions read; Metadata), and GitHub shows what it does as the human's with the App's mark. Not an OAuth
App nor a classic token: their `repo` scope reaches every private repository of the user, as `gh`'s token does, which
the agent may still use itself (Kulisa neither blocks it nor takes its token). Its client ID is in the code
(`main/api.ts`); it has no client secret or private key, which a desktop app cannot keep.

A **fine-grained token** the human makes and pastes is the other way, for an organization that will not install the
App: a member may only request its installation, its owner decides. Such a token reaches one owner's repositories,
with the permissions chosen when it is made (the page links GitHub's form: `NEW_TOKEN`); an organization may have to
approve it. A classic token (`ghp_`) is refused: it reaches every
repository.

## How it signs in (`main/github.ts`, `main/api.ts`)

As GitHub's docs say it ("Generating a user access token for a GitHub App", "Refreshing user access tokens"):

- **The device flow.** `POST github.com/login/device/code` with the client ID gives a code for the human, GitHub's page
  for it, how long it lives (15 minutes) and how often to ask (5 s). Kulisa shows the code itself, with Copy and a line:
  enter a code on GitHub only when Kulisa has just shown it. The client ID is public, so anyone can start a device flow
  that shows "Kulisa App" and send its code to a victim (a known phishing way); a code the human did not see Kulisa
  show is someone else's. Once the code is on screen, GitHub's page opens in the user's browser (`shell.openExternal`,
  given by the caller); Kulisa asks `POST github.com/login/oauth/access_token` at the interval until the human has
  entered it: `authorization_pending` asks again, `slow_down` waits longer (the interval GitHub gives, else 5 s more),
  `access_denied` and `expired_token` end it, saying so. One flow at a time; Cancel ends the waiting.
- **The tokens**: an access token for 8 hours, a refresh token for 6 months. Refreshed with `grant_type=refresh_token`
  and no secret (a device flow's token needs none), a few minutes before the access token ends, not after GitHub
  refuses it: a call made with a token about to end would fail on its way. Each refresh gives a new pair and ends the
  old one, so **one refresh at a time per account** (`Accounts.refreshing`), every caller waiting on it: two tasks'
  agents asking as the token ends would refresh with the same refresh token, and the second's refusal sign the account
  out for nothing. The new pair is **written before it is used** (`writeFileAtomic`): what is left is Kulisa quitting
  between GitHub's answer and the write, a fraction of a second, at worst one sign-in again. A refresh GitHub refuses
  signs the account out (Sign in Again, Settings → GitHub); the network failing does not (the next call tries again).
- **Who it is**: `GET /user` with the token gives its login. For a fine-grained token, its end too, from the header
  GitHub puts on every answer to one (`github-authentication-token-expiration`); a token past its end is signed out.
- **Signing in again** keeps the account (its id, its projects): with Kulisa App the device flow again, which must
  sign in as the same login; for a token, a new token pasted. A new device flow for a login that has an account already
  is that account (GitHub gives a user one authorization of an app); a token is an account of its own even for the same
  login, as each token is for one owner.
- Requests go through Electron's `net.fetch` (Chromium's network: the system's proxy, as the profiles' pages have it).
  `KULISA_GITHUB`, for the tests only, puts github.com and api.github.com (under `/api`) on the test site's fake GitHub.

## The accounts (`main/accounts.ts`)

`github.json` in Kulisa's data folder, `{ list: [{ id, login, kind, secret }] }`: its id six random characters
(`newId`), as an agent's account's; `kind` `app` or `pat`; `secret` its tokens, encrypted with the OS keyring
(`safeStorage`), none when signed out. It goes when the human deletes it (Settings → GitHub); the file is rewritten,
never added to. The log names an account by its id and login (`[github] k3x9ab (ann)`, `, token` for a token's), at
every start and as it is added, signed in again, signed out (with why: a refresh refused, GitHub refusing its token)
and deleted; never a token, a code or an address with a token in it.

**Without a keyring** (Linux with none: `safeStorage.getSelectedStorageBackend()` answers `basic_text`, Electron's
fixed key, as good as plain text), the tokens are kept in memory only: the sign-in lasts while Kulisa runs, and
Settings → GitHub says so in a line. A token writes as the human to their repositories: signing in again after a
restart costs less than a token any program of theirs could read.

**Deleting** an account forgets its tokens and its projects let go of it. GitHub's API to revoke a user's token needs
the App's client secret, which Kulisa has not, so the tokens live on GitHub until they end (8 hours; the refresh token
6 months), of use only to one who took them before; the question before deleting links where the human revokes it
(the App's authorization, https://github.com/settings/apps/authorizations; a token's list,
https://github.com/settings/personal-access-tokens).

## A repository's account

A project's repository goes as one account, chosen by its **remote**: its origin (where the human pushes) by what it
points to, the host and `owner/repo` (`remotes.ts` in the base, `remoteKey`: lower case, no scheme, user, token, port
or `.git`; an SSH host alias asked of `ssh -G`, a user or token in the address dropped at once). The binding is in the
project's entry in `projects.json`, `github: { "github.com/acme/shop": "<account id>" }`: by remote, not by folder, so
it is the same on every computer and survives the folder moving; it goes with its account, and with the repository
leaving the project unless another of its repositories has the same remote (`removeRepo`). With none bound, the first account that reaches it
(`GET /repos/{owner}/{repo}` as the account answers 200) is suggested and bound, so the account a repository's work goes
as stays the same whatever accounts come later, until the human chooses another on its row (Reka's Select). The row
says why none can: not a GitHub address (another host, or an SSH alias ssh cannot name); Kulisa App is not installed
on its owner, linking where it is installed or requested; a token that does not reach it; signed out; GitHub not
reached. The core of it is `GitHub.repo` (here) and `githubOf` (`projects.ts`, which knows the projects).

## The window

**Settings → GitHub** (`settings/GitHubPage.vue`, a page of Settings' tree after Agents), built as an agent's accounts
are: a `.list` of the accounts, a column each for its login, where Kulisa App is installed (`GET /user/installations`,
asked as the page is shown), the projects using it and when its sign-in ends (a refresh token's, a token's own), or
signed out. **+** adds one, With GitHub… or With a Token…; **−** and Delete delete the selected one, after the
question; its right-click: Sign in Again…, Delete…. A repository's row on a project's page has its account
(`settings/RepoAccount.vue`) and, under the list, a line for each that needs the human. Both are the window's (the
settings cluster): they use its components (menus, lists, the question), which a package's window half may not.

## Its channels (`ipc.ts`)

`github:accounts` (the list), `github:signin`, `github:signin-wait`, `github:signin-cancel` (the device flow: the code,
then waiting for it to be entered), `github:token` (a token pasted), `github:delete` (after the question). The
repositories' accounts are the window's channels, about a project: `project:github-get`, `project:github-set`
(`src/shared/ipc.ts`, `ipc/projects.ts`). `ipc.ts` also holds the pages of GitHub both halves name (`INSTALL`,
`REVOKE`, `NEW_TOKEN`).

## The code

| File | What |
|---|---|
| `main/index.ts` | the main process's entry: `GitHub`, and `installGitHub` (its channels, with what the caller says) |
| `main/github.ts` | signing in (the device flow, a token), the accounts as listed, a repository's account |
| `main/accounts.ts` | `github.json`, the tokens (encrypted, in memory without a keyring), one refresh at a time |
| `main/api.ts` | GitHub's endpoints, Kulisa App's client ID, `KULISA_GITHUB` |
| `ipc.ts` | its channels, what they answer, GitHub's pages |
| `github.test.ts` | the store, the refresh, no keyring, a repository's account (`npm run test:unit`) |

Outside it, each because it knows the rest: `src/main/remotes.ts` (a remote's key: the base, for #127's import too),
`projects.ts` (`githubOf`, `setGitHub`, `githubUsers`, `forgetGitHub`: the bindings in `projects.json`), `app.ts`
(making it: the keyring, `net.fetch`, `openExternal`, the question), `ipc/projects.ts` (the project's channels),
`settings/GitHubPage.vue` and `RepoAccount.vue`, `ProjectEditor.vue` (the tree's node, the rows), `Ask.vue` (a
question's link). Its e2e tests are in `test/github.ts` (the profiles group), against the test site's fake GitHub
(`test/fixtures/site.ts`, `/github`), and `restart-profiles.ts` (a sign-in kept with the keyring).

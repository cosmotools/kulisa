# GitHub

The human's GitHub accounts, as Kulisa keeps them: their sign-ins, what each reaches, and which one a repository's work
goes as. A Kulisa package ([docs/packages.md](../../docs/packages.md)): it knows nothing of projects, tasks or the
window; they use it. Why it is built so (an App, Kulisa holding the tokens, an account per repository): issue #48,
where the decisions are written down.

## The accounts

Several, as the agents' accounts (a work one and a personal one). Each lives until the human deletes it (Settings →
GitHub). Its id is GitHub's own user id, not its login: a login can be renamed on GitHub, the id stays. The same
GitHub account signed in again (Sign In Again) is that account, with its sign-in replaced.

**Kulisa holds the tokens; nothing else gets them.** They are encrypted with the OS keyring (the caller's `secrets`:
`safeStorage`, as session cookies and test passwords are) in `github.json`, never written in the clear (with no
keyring, none is kept and the sign-in is refused), never sent to the window, and never logged: the log's `summary`
leaves out a `token` argument (`github:token`), and the package's own lines name only the login. The device flow's
code is not logged either: it is a sign-in in progress.

**Signing in, with Kulisa App** (`github:signin`), GitHub's device flow, as the agents sign in: Kulisa asks GitHub for a code
(`/login/device/code`), shows it (`github:code`), and the human enters it on GitHub's page in their own browser (Copy Code
and Open GitHub: the code goes to the clipboard, the page opens outside Kulisa, as the agents' sign-ins do) and
authorizes Kulisa App there. Meanwhile Kulisa asks GitHub for the tokens at the interval GitHub gives
(`authorization_pending`; `slow_down` makes it slower), until the code expires (15 minutes) or the human cancels.
Kulisa App is registered by `cosmotools` (its Client ID in `main/api.ts`; it is public). It has no client secret:
a desktop app could not keep one, and neither the device flow nor its refresh needs one. Its permissions, chosen
when it was registered: Contents read; Pull requests and Issues read and write; Checks, Commit statuses and
Actions read; Metadata read. It reaches only the repositories it is installed on (Choose Repositories on GitHub:
`/apps/kulisa-app/installations/new`).

**Or with a fine-grained token** (`github:token`), which the human makes on GitHub and pastes (Use a Token Instead),
for an organization that does not let Kulisa App in. A classic token (`ghp_…` and the like) is refused: its scopes
reach every repository the human can, which is what the App is for avoiding. Its end is GitHub's
(`github-authentication-token-expiration`); it is never refreshed.

**Refreshed before it ends.** Kulisa App's access token lives 8 hours, its refresh token 6 months. Before a token is
used (`token`), one that ends within 5 minutes is refreshed: one refresh at a time per account, as each one replaces
the refresh token, and the new pair saved before the token is used, so a refresh is not lost. GitHub refusing the
refresh (`bad_refresh_token`), or a refresh token past its end, signs the account out (`expired`): it stays, marked
"signed out", until the human signs in to it again.

**Looked at again** (`github:refresh`) each time Settings → GitHub is shown: what each account reaches now (the App
installed on more repositories), and whether GitHub still takes it (revoked on GitHub: a 401 signs it out). One that
cannot be reached (offline) stays as it was.

**Deleted** (`github:delete`), after a question: Kulisa forgets its sign-in, and the projects let go of it (`deleted`,
the caller's). GitHub's API to revoke a token needs the App's client secret, so Kulisa cannot revoke it there: the
question says where the human does (GitHub's Settings → Applications; a token is deleted on its own page).

## A repository's account

A repository goes as one account. Its remote (`origin`) names the repository (`repoOf`: `https://github.com/…`,
`git@github.com:…`, `ssh://git@github.com/…`; the user or token a URL may hold is never kept). A remote on another
host, or an SSH host alias (Kulisa does not read the SSH config), is no GitHub repository. Kulisa suggests the account
that reaches it, else one whose login is its owner (`suggest`); one signed out is suggested for nothing. The human may
choose another on the repository's row (the project's Code, its right-click: GitHub Account); the choice is the
project's (`projects.json`, `github`: the repository's folder and the account), kept until changed back to
Suggested, the repository removed, or the account deleted. The package only answers what the remote is and what it
suggests (`forRemote`, `login`); the projects keep the choice (`projects.ts`: `githubOf`, `chooseGithub`).

## The agent's tools

GitHub's own MCP server's tools, given to the agent by Kulisa's MCP server (`mcp-server.ts`), so every agent gets
them, as Kulisa's own. Kulisa is its client (`main/tools.ts`, the MCP SDK's): the remote server
(`api.githubcopilot.com/mcp/`, no process of Kulisa's), with an account's token and its toolsets `repos`, `issues`,
`pull_requests` (`X-MCP-Toolsets`: all of them would be about a hundred tools in the agent's context every turn).
Its tools are listed once, with the first account signed in, at start or after a sign-in, and kept in memory (Kulisa's
MCP server is built per request, its tools at once); with no account, the agent has none. Their names, descriptions,
schemas (`z.fromJSONSchema`) and annotations are GitHub's; one named as one of Kulisa's own is left out. A connection
is kept per account while its token is the same; a session GitHub forgot (404) is made again once, and no call
that may have been made is made twice.

**Where it writes** (`Github.call`, the core's rule; issue #48, against a prompt injection that makes the agent write
anywhere as the human): a tool that changes something (not `readOnlyHint`) only for a repository of the task's
project (its `owner` and `repo`), as the account it goes as; reading also a public one outside it (GitHub's API says
so, found once per run), as the account of the project's first repository with one, else the first account signed in. A search names no repository: it
reads what that account reaches. The agent is told the project's repositories on GitHub (`githubContext`, at the
session's start and in the MCP server's instructions: `Project.github`, found again as the project loads, as its
page in Settings is read and as a tool is called). Nothing of this restricts the agent otherwise: `gh`, if the human
has it signed in, stays the agent's (the author, 2026-10-18).

## Its channels

`ipc.ts`: `github:accounts`, `github:refresh`, `github:signin` (its code as `github:code`), `github:signin-cancel`,
`github:token`, `github:delete`, all handled here. A repository's account is the window's channel
(`project:repo-github`, `ipc/projects.ts`): it is the project's.

## The tests' GitHub

`KULISA_GITHUB` puts a fake GitHub in GitHub's place (its site at that address, its API under `/api`): the tests' site
has one (`test/fixtures/site.ts`, `/github/`), where a test enters a code as the human does on GitHub, and revokes a
user's tokens.

## The code

| File | What |
|---|---|
| `main/index.ts` | its entry: `Github`, the channels, a remote's suggested account |
| `main/accounts.ts` | the accounts in `github.json`: signed in, a token refreshed, looked at again, signed out, deleted, suggested |
| `main/tools.ts` | GitHub's MCP server, as a client: its tools listed, a call as an account |
| `main/api.ts` | what Kulisa asks GitHub: the device flow, a refresh, who a token is, what it reaches; a remote's repository |
| `ipc.ts` | its channels' types |
| `github.test.ts` | its unit tests |

Its e2e tests: `test/tasks.ts` ("github: Settings → GitHub signs in …"; "partners: …" for a pull request's thread),
`test/restart-tasks.ts` (its tools listed again at the next start).

### Outside it, and why there

Each line outside the package that it needed (docs/packages.md: the caller states facts, the package does the work):

| Where | What | Why not in the package |
|---|---|---|
| `src/main/app.ts` | `new Github({ … })`; `loadTools()` once the app is ready | what only the app has: the data folder, the keyring (`secrets`), the projects using an account, the window that asks; the keyring is not before the app is ready |
| `src/main/shell.ts` | `github: Github` | the app every module gets |
| `src/main/ipc.ts` | `github:accounts`, `github:refresh` in `QUIET` | the log's own list of channels too frequent to log |
| `src/shared/ipc.ts`, `src/shared/types.ts` | its channels joined in; a repository's `github` on `ProjectRepo`; `project:repo-github` | the one table of every channel; a repository's row is the project's |
| `src/main/store.ts` | `ProjectEntry.github` | the account chosen for a repository is the project's, kept with it |
| `src/main/worktrees.ts` | `remoteOf` | git for projects is there, the user's git |
| `src/main/projects.ts` | `githubOf`, `chooseGithub`, `githubUsers`, `forgetGithub`, `Project.githubRepos` | the project's repositories and its choice of account; the package only says what a remote is and what it suggests |
| `src/main/ipc/projects.ts` | `project:repo-github` | the window's handle on a project's action |
| `src/main/kulisa-plugin/mcp-server.ts`, `agent-hooks.ts` | GitHub's tools registered for the agent; the project's repositories in its context | what the agent sees is the Kulisa plugin's (CLAUDE.md, Architecture); the rule of where they write is the package's (`Github.call`) |
| `src/main/partners.ts` | a pull request's thread (`pullOf`, `comment`, `comments`) | the partners' talk is about tasks and roles; the package gives the thread |
| `src/renderer/components/settings/GithubPage.vue`, `ProjectEditor.vue` | Settings → GitHub; a repository's GitHub column and GitHub Account | built of the window's components (one set of them: docs/ui.md), as the terminal's island is outside the terminal |
| `test/fixtures/site.ts`, `test/start.ts` | the tests' fake GitHub, `KULISA_GITHUB` | the tests' site serves every fake the tests need, in a process of its own |


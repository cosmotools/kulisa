// Names the human or the agent gives: projects, tasks, profiles. The characters of an email address, with the
// letters of any language: a profile is often named after the account it signs in to (ann+test@shop.com), and the
// names become folders, git branches and ids, where spaces and other signs get in the way.
// Checked where names are made (app.ts, project-profiles.ts); the window keeps other characters out of name fields
// as they are typed (preload, the renderer's lib/names.ts).
const CHAR = /^[\p{L}\p{M}\p{N}@._+-]$/u;
// Starting with a letter or a digit, as an email address does: not signs alone (@, -), no hidden folder (.x), no
// other folder (. and ..), no command-line option (-x).
const NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}@._+-]*$/u;
const MAX = 64;
const RULE = 'letters, digits and @ . _ + - only, starting with a letter or a digit, as an email address';

// Why a name cannot be used, or null.
function nameError(name: string | undefined): string | null {
  if (!name) return 'no name';
  if (name.length > MAX) return `at most ${MAX} characters`;
  return NAME.test(name) ? null : RULE;
}
const nameChar = (c: string) => CHAR.test(c);
// A part of a folder, branch or id made from a name: lower case, other characters as -.
const slugOf = (name: string, fallback: string) => name.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || fallback;
// The last part of a folder or repository URL, as git names a clone (git@github.com:me/shop.git, /srv/shop: shop):
// a project's or a clone's name until the human gives one.
const repoName = (url?: string | null) => (url || '').trim().replace(/[\\/]+$/, '').split(/[\\/:]/).pop()!.replace(/\.git$/, '');

export { nameError, nameChar, slugOf, repoName, MAX };

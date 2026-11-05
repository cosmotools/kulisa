// Shared validation for profile names, portable project folder names and free display labels (docs/tasks.md,
// Projects; docs/profiles.md). Profiles accept email-like names; folder names and labels have separate constraints.
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
// New project folders use the same portable subset on every OS; labels and existing paths keep their own rules.
function folderNameError(name: string | undefined): string | null {
  if (!name) return 'no name';
  if (name.length > MAX) return `at most ${MAX} characters`;
  if (/[^A-Za-z0-9._-]/.test(name)) return 'use A–Z, a–z, 0–9, hyphen (-), underscore (_) and dot (.) only';
  if (!/^[A-Za-z0-9]/.test(name)) return 'start with a letter or digit';
  if (name.endsWith('.')) return 'cannot end with a dot';
  // Windows treats a device name followed by any extension as the device too, regardless of letter case.
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return 'this name is reserved by Windows';
  return null;
}
// A task's name is a label a person reads ("Fix header"), shown as given and never a path: any text with a letter or a
// digit, on one line; its branch and folder take slugOf it.
function labelError(label: string | undefined): string | null {
  if (!label) return 'no name';
  if (label.length > MAX) return `at most ${MAX} characters`;
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(label)) return 'one line of text';
  return /[\p{L}\p{N}]/u.test(label) ? null : 'a letter or a digit at least';
}
// A part of a folder, branch or id made from a name: lower case, other characters as -.
const slugOf = (name: string, fallback: string) => name.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || fallback;
// The last part of a folder or repository URL, as git names a clone (git@github.com:me/shop.git, /srv/shop: shop):
// a project's or a clone's name until the human gives one.
const repoName = (url?: string | null) => (url || '').trim().replace(/[\\/]+$/, '').split(/[\\/:]/).pop()!.replace(/\.git$/, '');

export { nameError, nameChar, folderNameError, labelError, slugOf, repoName, MAX };

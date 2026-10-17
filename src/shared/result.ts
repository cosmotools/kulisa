// An action's answer (CLAUDE.md, "One core"): what it gives, or { error } saying why not. refused(r): whether it said
// no; past `if (refused(r)) return r;` TypeScript knows r is what was asked for.
// E: null too where the human said no (a question answered no: nothing to say).
type Result<T extends object = object, E extends string | null = string> = (T & { error?: undefined }) | { error: E };
const refused = <T extends object, E extends string | null>(r: Result<T, E>): r is { error: E } => r.error !== undefined;

export type { Result };
export { refused };

// An action's answer (CLAUDE.md, "One core"): what it gives, or { error } saying why not. refused(r): whether it said
// no; past `if (refused(r)) return r;` TypeScript knows r is what was asked for.
type Result<T extends object = object> = (T & { error?: undefined }) | { error: string };
const refused = <T extends object>(r: Result<T>): r is { error: string } => r.error !== undefined;

export type { Result };
export { refused };

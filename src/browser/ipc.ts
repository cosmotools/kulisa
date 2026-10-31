// Browser state sent to a host window; see README.md.
// A page's alert or confirm (Profile._dialog), shown in its pane.
interface PageDialog { id: number; type: 'alert' | 'confirm'; message: string; from: string; picture: string | null }
interface Tab {
  id: string; title: string; url: string; favicon: string | null; loading: boolean; canBack?: boolean; canFwd?: boolean;
  zoom: number; dialog?: PageDialog | null;
}
// An open profile in a host window (Profile.info).
export interface Profile {
  id: string; name: string; avatar: string; description: string | null; login: string | null;
  hasPassword: boolean; active: string | null; signinMode: boolean; tabs: Tab[];
}

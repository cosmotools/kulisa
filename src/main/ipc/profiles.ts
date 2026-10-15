// The windows' handles on the profiles in Settings → Profiles (docs/profiles.md; profile-store.ts): who each is, its
// master, deleting it.
import { nextAvatar } from '../../shared/avatars.ts';
import { deleteProfile } from '../projects.ts';
import { refused } from '../../shared/result.ts';
import { handle } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type * as Sent from '../../shared/types.ts'; // what the window gets: its one definition
import type { Result } from '../../shared/result.ts';

export function registerProfiles(ipc: Ipc) {
  const { shell, owner, serial } = ipc;
  const store = shell.store;
  // Settings → Profiles (profile-store.ts): every profile, each with the projects it is in; who one is changed (checked
  // in the store), then every loaded task shows it; made in no project; its master to sign in to; deleted after a
  // question (projects.ts, deleteProfile). Each answers with the list as it is then, or { error }.
  const profilesInfo = (): { profiles: Sent.SettingsProfile[] } => {
    const names = new Map(store.projects().map((p) => [p.id, p.name]));
    return { profiles: shell.profileStore.all().map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, description: g.description || '',
      login: g.login?.user || '', hasPassword: !!g.login?.secret, projects: g.projects.map((p) => names.get(p)).filter((n) => n !== undefined) })) };
  };
  const profileChange = (r: Result<{ id: string }>) => { if (refused(r)) return r; shell.profilesChanged(); return { ...profilesInfo(), id: r.id }; };
  handle('profiles:list', () => profilesInfo());
  handle('profiles:new', (_e, { name }) => {
    const bad = shell.profileStore.check({ name });
    if (bad) return { error: bad };
    const g = shell.profileStore.create(null, { name: name.trim(), avatar: nextAvatar(shell.profileStore.all().map((x) => x.avatar)) });
    return { ...profilesInfo(), id: g.id };
  });
  handle('profiles:rename', (_e, { profile, name }) => profileChange(shell.profileStore.rename(profile, name)));
  handle('profiles:describe', (_e, { profile, description }) => profileChange(shell.profileStore.describe(profile, description)));
  handle('profiles:avatar', (_e, { profile, avatar }) => profileChange(shell.profileStore.setAvatar(profile, avatar)));
  handle('profiles:login', (_e, { profile, user, password }) => {
    const s = shell.loginSecret(password);
    return refused(s) ? s : profileChange(shell.profileStore.setLogin(profile, user, s.secret));
  });
  handle('profiles:master', (_e, { profile }) => { const g = shell.profileStore.get(profile); return g ? shell.openMaster(g.folder) : { error: `no profile ${profile}` }; });
  handle('profiles:delete', (e, { profile }) => serial(async () => { const r = await deleteProfile(shell, profile, owner(e)); return refused(r) ? r : profilesInfo(); }));
}

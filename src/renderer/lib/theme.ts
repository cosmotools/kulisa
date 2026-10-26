// The windows' theme: the ☰ choice (data-theme: dark, light, system) and its shade as shadcn-vue's class dark, System
// following the OS. The pages set both before the first paint (index.html, settings.html).
const root = document.documentElement, osDark = matchMedia('(prefers-color-scheme: dark)');

export function setTheme(theme: string) {
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && osDark.matches));
}
osDark.addEventListener('change', () => setTheme(root.dataset.theme || 'dark'));

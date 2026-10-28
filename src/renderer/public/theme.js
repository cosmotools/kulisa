// The theme shown (lib/theme.ts): Dark, Light or System as shadcn's `dark` class and the root's color-scheme. A classic
// script read before the first paint, so a light window never flashes dark: the page's URL's theme (window.ts, load;
// main/master.ts) at once, then each one lib/theme.ts gives showTheme; System follows the OS's.
{
  const root = document.documentElement, osDark = matchMedia('(prefers-color-scheme: dark)');
  let shown = new URLSearchParams(location.search).get('theme') || 'dark';
  window.showTheme = (theme) => {
    const dark = theme !== 'light' && (theme !== 'system' || osDark.matches);
    shown = theme;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = theme === 'system' ? 'light dark' : dark ? 'dark' : 'light'; // scrollbars, the native controls
  };
  showTheme(shown);
  osDark.addEventListener('change', () => showTheme(shown));
}

// The menu at a point (lib/menu.ts, menuAt): a link in the terminal, a screenshot's thumbnail. Closed as any menu is;
// the keyboard then back where it was (the terminal).
import { closePointMenu, usePointMenu } from '../lib/menu';
import { MenuAt } from './Menus';

export function PointMenu() {
  const m = usePointMenu();
  return <MenuAt at={m} items={m?.items ?? []} onClosed={closePointMenu} />;
}

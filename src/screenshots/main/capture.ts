// A picture of a page: an element, the visible part or the whole page (../README.md).
import type { Locator, Page } from 'playwright-core';

interface Shot {
  element?: (page: Page) => Locator | Promise<Locator>; // else the visible part, or the whole page with fullPage
  fullPage?: boolean;
  scale: 'css' | 'device';
  type: 'png' | 'jpeg';
  human?: string; // taken by the human: a key the caller asks takenByHuman with
}

// Playwright's glass (x-pw-glass, a popover in the top layer) holds the agent's marks: its pointer, the actions'
// outlines, browser_highlight's. Not in the picture: they are Kulisa's, not the site's.
const NO_MARKS = 'x-pw-glass { display: none !important; }';

// The human's pictures go through the same connection as the agent's commands: whoever captions those asks here.
const byHuman = new Set<string>();
const takenByHuman = (key: string) => byHuman.has(key);

async function capture(page: Page, shot: Shot): Promise<Buffer> {
  const opts = { type: shot.type, ...(shot.type === 'jpeg' && { quality: 70 }), scale: shot.scale, style: NO_MARKS, timeout: 10_000 };
  const { human } = shot;
  if (human) byHuman.add(human);
  try {
    if (shot.element) return await (await shot.element(page)).first().screenshot(opts);
    return await page.screenshot({ ...opts, fullPage: !!shot.fullPage });
  } finally { if (human) byHuman.delete(human); }
}

export { capture, takenByHuman };
export type { Shot };

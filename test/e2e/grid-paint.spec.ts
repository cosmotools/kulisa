// A restored grid and its terminal content reach the screen together.
import { test, expect } from './fixtures.ts';
import { dock, frames, notLoading } from './helpers.ts';
import { newTask, showTask } from './tasks-helpers.ts';

test('task switching paints the terminal belonging to the completed layout', async ({ core, ui }) => {
  await notLoading(ui);
  await ui.addStyleTag({ content: '#resources > nav { background: rgb(0, 0, 160) !important; }' });
  await frames(ui);
  const first = await core((k) => k.shell.task.key);
  const paint = async (color: number) => {
    await expect.poll(() => ui.getByTestId('terminal').evaluate((el) => {
      const term = (window as any).__term;
      const screen = el.querySelector('.xterm-screen').getBoundingClientRect();
      return el.clientHeight - screen.height < screen.height / term.rows + 5 && term.rows > 20;
    })).toBe(true);
    const size = await ui.evaluate(() => ({ cols: (window as any).__term.cols, rows: (window as any).__term.rows }));
    // Distinct output makes stale terminal pixels detectable without reading text from an image.
    await core((k, a) => k.shell.win.webContents.send('pty:out', { task: k.shell.task.promptTarget().key,
      ...a.size, data: `\x1b[38;2;${a.color === 0xa00000 ? '160;0;0' : '0;160;0'};48;2;${a.color === 0xa00000 ? '160;0;0' : '0;160;0'}m\x1b[2J\x1b[H${Array(a.size.rows).fill('█'.repeat(a.size.cols - 1)).join('\r\n')}\x1b[H` }), { color, size });
    await expect.poll(() => ui.evaluate(() => (window as any).__term.buffer.active.getLine(10).getCell(10).getBgColor())).toBe(color);
    await frames(ui);
  };
  await dock(ui, (api) => api.getPanel('resources').api.setSize({ width: 380 }));
  await paint(0xa00000);
  const second = await newTask(core, ui);
  await notLoading(ui);
  await dock(ui, (api) => {
    api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'right' });
    api.getPanel('resources').api.setSize({ width: 300 });
  });
  await paint(0x00a000);
  await showTask(core, ui, first);
  await notLoading(ui);
  await ui.evaluate(() => document.activeViewTransition?.finished);
  await frames(ui);
  const size = await ui.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const images: Buffer[] = [];
  const recording = await ui.screencast.start({ fps: 60, quality: 95, size, onFrame: ({ data }) => { images.push(data); } });
  try {
    for (let i = 0; i < 10; i++) {
      await showTask(core, ui, i % 2 === 0 ? second : first);
      await notLoading(ui);
      await ui.evaluate(() => document.activeViewTransition?.finished);
      await frames(ui);
    }
  } finally { await recording.dispose(); }
  expect(images.length).toBeGreaterThan(3);
  const pixels = await ui.evaluate(async ({ encoded, width, height }) => {
    const canvas = new OffscreenCanvas(8, 8), context = canvas.getContext('2d');
    const result: { left: number[]; middle: number[]; leftRail: number[]; rightRail: number[] }[] = [];
    for (const data of encoded) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const sample = (x: number) => {
        context.drawImage(image, x * image.width / width, image.height / 2, 8 * image.width / width, 8 * image.height / height, 0, 0, 8, 8);
        const rgba = context.getImageData(0, 0, 8, 8).data, rgb = [0, 0, 0];
        for (let i = 0; i < rgba.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += rgba[i + c] / 64;
        return rgb.map(Math.round);
      };
      result.push({ left: sample(100), middle: sample(Math.round(width / 2)), leftRail: sample(10), rightRail: sample(width - 20) });
      image.close();
    }
    return result;
  }, { encoded: images.map((image) => image.toString('base64')), ...size });
  const bad = pixels.flatMap((frame, i) => {
    const red = (rgb: number[]) => rgb[0] > 110 && rgb[1] < 40;
    const green = (rgb: number[]) => rgb[0] < 40 && rgb[1] > 110;
    const dark = (rgb: number[]) => rgb[0] < 60 && rgb[1] < 60;
    const blue = (rgb: number[]) => rgb[0] < 40 && rgb[1] < 40 && rgb[2] > 110;
    return (dark(frame.left) && red(frame.middle) && blue(frame.leftRail))
      || (green(frame.left) && green(frame.middle) && blue(frame.rightRail)) ? [] : [{ frame: i, ...frame }];
  });
  for (const frame of bad.slice(0, 5)) await test.info().attach(`incomplete-frame-${frame.frame}`, { body: images[frame.frame], contentType: 'image/jpeg' });
  expect(bad, 'each painted frame contains one task layout with its own terminal').toEqual([]);
});

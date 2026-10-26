// The thumbnail's page (../README.md, The thumbnail): the picture only; what is done with it, the main process does.
const style = document.createElement('style');
// Around the picture, room for its shadow and its × (PAD in ../main/thumbnail.ts). Its frame is the window's (Thumbnail.vue)
// written out, its × drawn here: this page imports nothing of the window, the sprite neither (../CLAUDE.md).
// FADE in ../main/thumbnail.ts is its fading out's time.
style.textContent = `html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  body { box-sizing: border-box; padding: 12px; position: relative; opacity: 0; scale: .96; transition: opacity .2s ease, scale .2s ease; }
  body[data-state="in"] { opacity: 1; scale: 1; }
  body[data-state="out"] { opacity: 0; scale: .96; }
  @media (prefers-reduced-motion: reduce) { body { transition: none; } }
  img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; cursor: pointer; border-radius: 4px;
    outline: 1px solid #ffffff80; outline-offset: -1px; box-shadow: 0 0 0 1px #00000030, 0 3px 10px #00000060; }
  button { position: absolute; inset-block-start: 2px; inset-inline-start: 2px; width: 20px; height: 20px; padding: 0; border: 0;
    border-radius: 50%; display: grid; place-items: center; background: #1e1f22d9; color: #ffffff; cursor: pointer;
    box-shadow: 0 0 0 1px #ffffff80; opacity: 0; transition: opacity .15s ease; }
  body:hover button { opacity: 1; }`;
document.head.append(style);
const img = document.createElement('img');
img.alt = 'Screenshot'; img.draggable = true;
const closer = document.createElement('button');
closer.title = 'Close';
closer.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>';
document.body.append(img, closer);
kulisa.on('thumbnail:image', (src) => { img.src = src; });
img.addEventListener('load', () => { document.body.dataset.state = 'in'; }, { once: true });
kulisa.on('thumbnail:fade', () => { document.body.dataset.state = 'out'; });
closer.addEventListener('click', () => kulisa.send('thumbnail:close'));
img.addEventListener('click', () => kulisa.send('thumbnail:open'));
// The file itself is dragged (webContents.startDrag), not the page's image.
img.addEventListener('dragstart', (e) => { e.preventDefault(); kulisa.send('thumbnail:drag'); });
document.addEventListener('contextmenu', (e) => { e.preventDefault(); kulisa.send('thumbnail:menu', { x: e.clientX, y: e.clientY }); });
document.documentElement.addEventListener('mouseenter', () => kulisa.send('thumbnail:hover', true));
document.documentElement.addEventListener('mouseleave', () => kulisa.send('thumbnail:hover', false));

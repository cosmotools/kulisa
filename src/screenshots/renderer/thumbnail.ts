// The thumbnail's page (../README.md, The thumbnail): the picture only; what is done with it, the main process does.
import { createElement, X } from 'lucide';
import './thumbnail.css';

// Around the picture, room for its shadow and its × (PAD in ../main/thumbnail.ts: p-3). Its colors are Tailwind's own:
// this page imports nothing of the window (../CLAUDE.md). FADE in ../main/thumbnail.ts is its fading out's time.
document.documentElement.className = 'h-full overflow-hidden bg-transparent';
document.body.className = `group relative h-full p-3 opacity-0 scale-96 transition-[opacity,scale] duration-200 motion-reduce:transition-none
  data-[state=in]:opacity-100 data-[state=in]:scale-100`;
const img = document.createElement('img');
img.alt = 'Screenshot'; img.draggable = true;
img.className = 'block size-full cursor-pointer rounded-sm object-cover object-top shadow-lg ring-1 ring-black/20 outline outline-white/50 -outline-offset-1';
const closer = document.createElement('button');
closer.title = 'Close';
closer.className = `absolute start-0.5 top-0.5 grid size-5 cursor-pointer place-items-center rounded-full bg-neutral-900/85 text-white
  opacity-0 ring-1 ring-white/50 transition-opacity group-hover:opacity-100`;
closer.append(createElement(X, { class: 'size-3', 'stroke-width': 2.5 }));
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

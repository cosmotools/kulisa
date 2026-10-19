// The thumbnail's page (../README.md, The thumbnail): the picture only; what is done with it, the main process does.
const style = document.createElement('style');
style.textContent = `html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; cursor: pointer; }`;
document.head.append(style);
const img = document.createElement('img');
img.alt = 'Screenshot'; img.draggable = true;
document.body.append(img);
kulisa.on('thumbnail:image', (src) => { img.src = src; });
img.addEventListener('click', () => kulisa.send('thumbnail:open'));
// The file itself is dragged (webContents.startDrag), not the page's image.
img.addEventListener('dragstart', (e) => { e.preventDefault(); kulisa.send('thumbnail:drag'); });
document.addEventListener('contextmenu', (e) => { e.preventDefault(); kulisa.send('thumbnail:menu', { x: e.clientX, y: e.clientY }); });
document.documentElement.addEventListener('mouseenter', () => kulisa.send('thumbnail:hover', true));
document.documentElement.addEventListener('mouseleave', () => kulisa.send('thumbnail:hover', false));

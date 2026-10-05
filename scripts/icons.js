// Renders the app icon from assets/icon.svg into what each OS needs, next to it in assets/:
//   icon.png (1024, Linux and the window), icon.ico (Windows), icon.icns (macOS).
// Run after changing the SVG: npm run icons. The outputs are committed, so packaging does not need this.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const png2icons = require('png2icons');

const dir = path.join(__dirname, '..', 'assets');
const png = new Resvg(fs.readFileSync(path.join(dir, 'icon.svg')), { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
fs.writeFileSync(path.join(dir, 'icon.png'), png);
fs.writeFileSync(path.join(dir, 'icon.ico'), png2icons.createICO(png, png2icons.BICUBIC2, 0, false, true));
fs.writeFileSync(path.join(dir, 'icon.icns'), png2icons.createICNS(png, png2icons.BICUBIC2, 0));
console.log('assets/icon.png, icon.ico, icon.icns');

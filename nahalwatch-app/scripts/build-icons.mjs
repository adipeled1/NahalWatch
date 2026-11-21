// Renders the app icon (water drop + leaf) to every PNG size the PWA / iOS home screen needs.
// Run with `npm run icons`. Output: public/icons/*.png and src/app/{icon,apple-icon}.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// `pad` shrinks the artwork for maskable icons (Android crops to a circle).
const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d8a55"/><stop offset="1" stop-color="#075c39"/>
    </linearGradient>
    <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fd3ff"/><stop offset="1" stop-color="#1c8fd0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${256 - 256 * (1 - pad)} ${256 - 256 * (1 - pad)}) scale(${1 - pad})">
    <path d="M300 92 C 300 92 392 206 392 286 a 104 104 0 0 1 -208 0 C 184 206 300 92 300 92 Z" fill="url(#drop)"/>
    <path d="M300 92 C 300 92 392 206 392 286 a 104 104 0 0 1 -60 94 C 380 300 340 190 300 92 Z" fill="#ffffff" opacity=".18"/>
    <path d="M118 382 C 104 274 168 196 268 182 C 270 284 214 362 118 382 Z" fill="#b8f0c8"/>
    <path d="M128 372 C 170 300 210 252 258 196" stroke="#0b6b42" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M222 318 q 26 -20 52 0 t 52 0" stroke="#ffffff" stroke-width="13" stroke-linecap="round" fill="none" opacity=".9"/>
  </g>
</svg>`;

const out = [
  ['public/icons/icon-192.png', 192, 0],
  ['public/icons/icon-512.png', 512, 0],
  ['public/icons/maskable-512.png', 512, 0.18],
  ['src/app/icon.png', 64, 0],
  ['src/app/apple-icon.png', 180, 0],
];
fs.mkdirSync(path.join(ROOT, 'public/icons'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/icons/icon.svg'), svg());
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(path.join(ROOT, file));
  console.log('✓', file);
}

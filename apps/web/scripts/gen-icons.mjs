// Gera os ícones do PWA a partir do ícone aprovado (provisório no M0).
// Compõe o símbolo sobre um quadrado preto de cantos arredondados.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'public', 'brand', 'CONTRO_icone_app.png');
const outDir = join(root, 'public', 'icons');

const BLACK = { r: 0x18, g: 0x18, b: 0x18, alpha: 1 };

function roundedMask(size) {
  const r = Math.round(size * 0.24); // ícone do app = 24% do lado
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
  );
}

async function gen(size, { maskable = false } = {}) {
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BLACK },
  });
  // margem: maskable precisa de "safe zone" (~10%); normal usa margem menor.
  const pad = Math.round(size * (maskable ? 0.2 : 0.12));
  const inner = size - pad * 2;
  const symbol = await sharp(await readFile(src))
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const composed = await canvas
    .composite([{ input: symbol, top: pad, left: pad }])
    .png()
    .toBuffer();
  const mask = roundedMask(size);
  return sharp(composed)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'icon-192.png'), await gen(192));
await writeFile(join(outDir, 'icon-512.png'), await gen(512));
await writeFile(join(outDir, 'icon-maskable-512.png'), await gen(512, { maskable: true }));
console.log('Ícones gerados em public/icons/');

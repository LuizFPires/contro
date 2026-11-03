// Badge monocromático para a barra de status do Android.
// Usa o contorno vetorial da marca, sem o fundo do ícone do aplicativo.
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = await readFile(
  new URL('../../../packages/ui/src/brand/CONTRO_icone.svg', import.meta.url),
  'utf8',
);
const shape = source.match(/<clipPath id="shape"><path d="([^"]+)"/);
if (!shape) throw new Error('Contorno do símbolo CONTRO não encontrado');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><g transform="translate(44 18)"><path fill="white" d="${shape[1]}"/></g></svg>`;
const output = new URL('../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });
await sharp(Buffer.from(svg))
  .resize(96, 96)
  .png()
  .toFile(fileURLToPath(new URL('badge-96.png', output)));
console.log('Badge CONTRO gerado: 96 × 96, símbolo branco e fundo transparente.');

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const [source, destination] = process.argv.slice(2);

if (!source || !destination) {
  throw new Error('source와 destination 경로가 필요합니다.');
}

await mkdir(path.dirname(destination), { recursive: true });
await sharp(source)
  .resize(720, 720, {
    background: { alpha: 0, b: 0, g: 0, r: 0 },
    fit: 'contain',
  })
  .webp({ alphaQuality: 100, quality: 82 })
  .toFile(destination);

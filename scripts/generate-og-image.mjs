#!/usr/bin/env node
/**
 * Build public/og-image.jpg (1200×630) from the iOS app icon for Open Graph / Twitter cards.
 *
 *   npm run generate:og-image
 */
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
const outPath = join(root, 'public/og-image.jpg');

const width = 1200;
const height = 630;
const iconSize = 240;

const backgroundSvg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="45%" stop-color="#f4f7fb"/>
      <stop offset="100%" stop-color="#ede9fe"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="600" y="430" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="52" font-weight="700" fill="#0f766e">Our Finance — Together</text>
  <text x="600" y="490" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="26" fill="#475569">Bills, budgets, and paycheques in one private workbook</text>
</svg>`;

const iconBuffer = await sharp(iconPath).resize(iconSize, iconSize).png().toBuffer();
const left = Math.round((width - iconSize) / 2);
const top = 100;

await sharp(Buffer.from(backgroundSvg))
  .composite([{ input: iconBuffer, left, top }])
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
console.log(`Wrote ${outPath} (${meta.width}×${meta.height})`);

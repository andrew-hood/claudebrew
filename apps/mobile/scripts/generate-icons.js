#!/usr/bin/env node
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function main() {
  // icon.png — 1024×1024 full icon with gradient bg
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓ icon.png');

  // adaptive-icon.png — 1024×1024, transparent bg, just cup+sparkles
  // Re-render SVG without background rect
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const transparentSvg = svgContent.replace(
    /<!-- Background -->\s*<rect[^>]*fill="url\(#bg\)"[^>]*\/>/,
    ''
  );
  await sharp(Buffer.from(transparentSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  // splash.png — 1284×2778, cup+sparkles (no amber bg) centered on dark background
  const iconBuffer = await sharp(Buffer.from(transparentSvg))
    .resize(600, 600)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1284,
      height: 2778,
      channels: 4,
      background: { r: 28, g: 20, b: 16, alpha: 1 },
    },
  })
    .composite([{
      input: iconBuffer,
      gravity: 'center',
    }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('✓ splash.png');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');

  const mod = require('png-to-ico');
  const pngToIco = mod.default || mod;
  if (typeof pngToIco !== 'function') throw new Error('png-to-ico export not callable');

  const repoRoot = path.resolve(__dirname, '..', '..');
  const srcPreferred = path.join(repoRoot, 'frontend', 'public', 'icon-source.png');
  const srcFallback = path.join(repoRoot, 'frontend', 'public', 'logo.png');
  const srcPng = fs.existsSync(srcPreferred) ? srcPreferred : srcFallback;

  const outSquarePng = path.join(repoRoot, 'frontend', 'public', 'logo-icon.png');
  const outIco = path.join(repoRoot, 'desktop', 'icon.ico');

  if (!fs.existsSync(srcPng)) {
    throw new Error(`Source logo not found: ${srcPng}`);
  }

  // 512x512 exact square (no aspect ratio preservation)
  const resized = await sharp(srcPng).resize(512, 512, { fit: 'fill' }).png().toBuffer();

  fs.mkdirSync(path.dirname(outSquarePng), { recursive: true });
  fs.writeFileSync(outSquarePng, resized);

  const buf = await pngToIco(outSquarePng);
  fs.writeFileSync(outIco, buf);
  // eslint-disable-next-line no-console
  console.log(`[icon] wrote ${outIco}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[icon] failed', e?.message || e);
  process.exit(1);
});


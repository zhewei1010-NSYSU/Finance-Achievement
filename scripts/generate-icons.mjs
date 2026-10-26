import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
// Use the site's own pig illustration to preserve its identity, with an opaque safe-area canvas.
const source = await readFile(new URL('../src/components/PinkPig.tsx', import.meta.url), 'utf8')
const pig = source
  .slice(source.indexOf('      <defs>'), source.indexOf('    </svg>'))
  .replaceAll('className=', 'class=')
  .replaceAll('stopColor=', 'stop-color=')
  .replaceAll('strokeWidth=', 'stroke-width=')
  .replaceAll('strokeLinecap=', 'stroke-linecap=')
  .replaceAll('strokeLinejoin=', 'stroke-linejoin=')
  .replaceAll('id={bodyId}', 'id="pig-body"')
  .replaceAll('id={earId}', 'id="pig-ear"')
  .replaceAll('fill={`url(#${bodyId})`}', 'fill="url(#pig-body)"')
  .replaceAll('fill={`url(#${earId})`}', 'fill="url(#pig-ear)"')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fff1f5"/><circle cx="256" cy="256" r="205" fill="#fff9fb"/><g transform="translate(62 93) scale(1.49)">${pig}</g></svg>`
await writeFile(new URL('../public/pig-icon.svg', import.meta.url), svg)
for (const [size, name] of [
  [192, 'pwa-192.png'],
  [512, 'pwa-512.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/${name}`, import.meta.url).pathname)
}

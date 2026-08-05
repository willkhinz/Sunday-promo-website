import { continueRender, delayRender, staticFile } from 'remotion';

export const sans = 'Inter';
export const monospace = 'JetBrains Mono';

const specs: Array<{ family: string; weight: string; file: string }> = [
  { family: sans, weight: '400', file: 'inter-latin-400-normal.woff2' },
  { family: sans, weight: '500', file: 'inter-latin-500-normal.woff2' },
  { family: sans, weight: '600', file: 'inter-latin-600-normal.woff2' },
  { family: sans, weight: '700', file: 'inter-latin-700-normal.woff2' },
  { family: monospace, weight: '400', file: 'jetbrains-mono-latin-400-normal.woff2' },
  { family: monospace, weight: '500', file: 'jetbrains-mono-latin-500-normal.woff2' },
];

const handle = delayRender('Loading local fonts');

Promise.all(
  specs.map(async (spec) => {
    const font = new FontFace(spec.family, `url(${staticFile(`fonts/${spec.file}`)})`, {
      weight: spec.weight,
    });
    await font.load();
    (document.fonts as FontFaceSet).add(font);
  })
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });

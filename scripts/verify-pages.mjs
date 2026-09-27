import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('artifacts/evomon-pokedex/dist/public');
const base = '/Evomon-Pokedex/';
const html = await readFile(path.join(output, 'index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^(?:https?:|data:|#)/.test(url));
assert(localAssets.some((url) => url.endsWith('.js')), 'Built JavaScript is missing');
assert(localAssets.some((url) => url.endsWith('.css')), 'Built CSS is missing');
for (const url of localAssets) {
  assert(url.startsWith(base), `Asset must use the Pages base path: ${url}`);
  assert((await stat(path.join(output, url.slice(base.length)))).isFile(), `Missing asset: ${url}`);
}
assert.equal(await readFile(path.join(output, '404.html'), 'utf8'), html, 'Direct links need the same app shell');
for (const file of ['bubboxer.png', 'blazpup.png', 'favicon.svg']) {
  assert((await stat(path.join(output, file))).isFile(), `Missing public asset: ${file}`);
}
console.log('Pages output verified: built assets, base path, artwork, and direct-link fallback.');

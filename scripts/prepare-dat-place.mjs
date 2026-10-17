import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

// Publish this directory inside Terapagos/bio at /evomon; keep other pages intact.
const output = path.resolve('artifacts/evomon-pokedex/dist/public');
const shell = await readFile(path.join(output, 'index.html'), 'utf8');
if (!shell.includes('/evomon/assets/')) throw new Error('Build with BASE_PATH=/evomon/ first');
const origin = process.env.VITE_API_URL || 'https://terapagos-evomon-api.fly.dev';
const response = await fetch(`${origin}/api/evomon`, { signal: AbortSignal.timeout(180000) });
if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
const catalog = await response.json();
const supplied = JSON.parse(await readFile('artifacts/api-server/src/data/owner-species.json', 'utf8'));
const routes = new Set(['skills']);
for (const mon of [...catalog.mons, ...supplied]) {
  for (const id of [mon.id, mon.name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')]) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Unsafe catalog ID: ${id}`);
    routes.add(`evomon/${id}`);
  }
}
for (const route of routes) {
  const directory = path.join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), shell);
}
await copyFile(path.join(output, 'index.html'), path.join(output, '404.html'));
console.log(`Prepared dat.place/evomon with ${routes.size} direct routes.`);


import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.argv[2];
assert(origin, 'Pass the API origin as the first argument');
const headers = { Origin: 'https://terapagos.github.io' };
let healthy = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(`${origin}/api/healthz`, { headers, signal: AbortSignal.timeout(5000) });
    if (response.ok && (await response.json()).status === 'ok') {
      healthy = true;
      break;
    }
  } catch { /* Wait for the server to start. */ }
  await delay(1000);
}
assert(healthy, 'API did not become healthy');
const response = await fetch(`${origin}/api/evomon`, { headers, signal: AbortSignal.timeout(180000) });
assert.equal(response.status, 200, 'Catalog request failed');
assert(['*', headers.Origin].includes(response.headers.get('access-control-allow-origin')), 'Pages origin must be allowed by CORS');
const catalog = await response.json();
assert(Array.isArray(catalog.mons) && catalog.mons.length > 0, 'Catalog must contain Evomon');
assert(catalog.mons.every((mon) => mon.id && mon.name), 'Catalog entries need IDs and names');
assert(catalog.mons.some((mon) => Array.isArray(mon.moves) && mon.moves.length > 0), 'Skills must contain moves');
console.log(`API verified: health, ${catalog.mons.length} catalog entries, skills, and Pages CORS.`);

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';

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
const supplement = JSON.parse(await readFile(new URL('../artifacts/api-server/src/data/replit-move-supplement.json', import.meta.url), 'utf8'));
let verifiedMoves = 0;
for (const [name, moves] of Object.entries(supplement.learnsets)) {
  const mon = catalog.mons.find((entry) => entry.name === name);
  assert(mon, `Missing maintained Evomon: ${name}`);
  for (const [moveName, level, slot] of moves) {
    const matches = mon.moves.filter((move) => move.name === moveName && move.unlockLevel === level
      && (move.slot === 'ultimate') === (slot === 'ultimate'));
    assert.equal(matches.length, 1, `${name}: expected exactly one ${moveName} at level ${level}`);
    const move = matches[0];
    assert(move.description && move.element && move.category, `${name}: incomplete ${moveName} details`);
    verifiedMoves++;
  }
}
for (const [name, moves] of Object.entries(supplement.exactLearnsets ?? {})) {
  const mon = catalog.mons.find((entry) => entry.name === name);
  assert(mon, `Missing reference Evomon: ${name}`);
  assert.deepEqual(mon.moves, moves, `${name}: moveset must match the Replit reference exactly`);
}
assert(catalog.mons.find((mon) => mon.name === 'Bubble').moves.some((move) => move.name === 'Water Pulse' && move.unlockLevel === 140), 'Bubble must retain its late-level Water Pulse');
console.log(`Verified ${verifiedMoves} restored move assignments across ${Object.keys(supplement.learnsets).length} Evomon.`);
console.log(`API verified: health, ${catalog.mons.length} catalog entries, skills, and Pages CORS.`);


const ownerSpecies = JSON.parse(await readFile(new URL('../artifacts/api-server/src/data/owner-species.json', import.meta.url), 'utf8'));
const recording = JSON.parse(await readFile(new URL('../artifacts/api-server/src/data/recording-catalog.json', import.meta.url), 'utf8'));
for (const expected of ownerSpecies) {
  const matches = catalog.mons.filter((mon) => mon.id === expected.id || mon.name === expected.name);
  assert.equal(matches.length, 1, expected.name + ': expected one catalog entry');
  assert.deepEqual(matches[0], { ...expected, ...recording.artwork[String(expected.dexNumber)] }, expected.name + ': must preserve owner-supplied forms and moves');
}
console.log('Verified owner-supplied species, evolution lines, forms, and complete movesets.');
for (const expected of recording.entries) {
  const matches = catalog.mons.filter((mon) => mon.dexNumber === expected.dexNumber);
  assert.equal(matches.length, 1, `${expected.name}: expected one catalog entry`);
  assert.equal(matches[0].name, expected.name);
  assert.deepEqual(matches[0].element, expected.element);
  assert.deepEqual(matches[0].evolutionLine, expected.evolutionLine, `${expected.name}: preserve confirmed evolution line`);
  assert.equal(matches[0].stage, expected.stage, `${expected.name}: preserve confirmed evolution stage`);
  assert.deepEqual(matches[0].baseStats, {}, 'Unseen stats must stay unrecorded');
  assert.deepEqual(matches[0].moves, expected.moves, `${expected.name}: preserve recorded moves and leave unseen moves unrecorded`);
  assert.equal(matches[0].legendaryTrait, expected.legendaryTrait, `${expected.name}: preserve recorded legendary trait`);
  assert.equal(matches[0].legendaryTraitEffect, expected.legendaryTraitEffect, `${expected.name}: preserve recorded legendary effect`);
}
for (const [number, artwork] of Object.entries(recording.artwork)) {
  const mon = catalog.mons.find((entry) => entry.dexNumber === Number(number));
  assert(mon, `Missing artwork recipient #${number}`);
  for (const [field, url] of Object.entries(artwork)) assert.equal(mon[field], url);
}
assert.equal(new Set(catalog.mons.map((mon) => mon.id)).size, catalog.mons.length, 'Duplicate catalog IDs');
console.log(`Verified ${recording.entries.length} recording additions and all artwork assignments.`);


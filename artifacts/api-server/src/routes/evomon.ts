import { Router, type IRouter } from "express";
import { GetEvomonCatalogResponse } from "@workspace/api-zod";

const WIKI_ORIGIN = "https://www.evomon.wiki";
const WIKI_URL = `${WIKI_ORIGIN}/wiki`;
const TRAITS_URL = `${WIKI_ORIGIN}/traits`;
const MOVES_URL = `${WIKI_ORIGIN}/moves`;
const CACHE_MS = 1000 * 60 * 60 * 6;

type JsonObject = Record<string, unknown>;
type StatBlock = Record<string, number>;
type MoveTag = "Physical" | "Sp. Atk" | "Support" | "Priority" | "Status condition" | "Weather" | "AoE" | "Single target";

type CatalogMove = {
  name: string;
  element: string;
  category: string;
  description: string;
  obtained: string | null;
  unlockLevel: number | null;
  slot: string;
  power: string | null;
  uses: number | null;
  tags: MoveTag[];
};

const MOVE_LEVELS = [1, 1, 10, 20, 40, 50, 60, 70, 90, 100, 120, 140];
const ULTIMATE_LEVELS = [30, 80, 150];
type SupplementalMoveList = { normal: string[]; ultimate: string[] };

// These records come from the supplied base-form move lists. A few names use
// the Wiki's spelling/numbering so they resolve to live definitions.
const SUPPLEMENTAL_BASE_MOVES: Record<string, SupplementalMoveList> = {
  Glaclide: {
    normal: [
    "Hone 1", "Heavy Strike", "Ice Spike", "Frostbite", "Snow Clear", "Frozen",
    "Ice Ball", "Rest", "Shockwave", "Snowfall", "Hail", "Snow Lance",
    ],
    ultimate: ["Frigid Force 1", "Frigid Force 2", "Frigid Force 3"],
  },
  Chitmite: {
    normal: [
    "Intimidate", "Heavy Strike", "Insect Rush", "Smoke Cover", "Bug Drain", "Poison Spike",
    "Heavy Slam", "Web Bind", "Poison", "Wing Blade", "Energy Absorb", "Venom Spray",
    ],
    ultimate: ["Toxic Bite 1", "Toxic Bite 2", "Toxic Bite 3"],
  },
  Lavite: {
    normal: [
    "Steady", "Ram", "Fire Strike", "Burn", "Cinder", "Hone 1", "Stone Edge", "Fatal Rebound",
    "Cremate", "Wildfire", "Earth Power", "Flame Tear",
    ],
    ultimate: ["Sandstorm Eruption 1", "Sandstorm Eruption 2", "Sandstorm Eruption 3"],
  },
  Stardrift: {
    normal: [
    "Smoke Cover", "Heavy Strike", "Vine Drain", "Icy Wind", "Recover 1", "Heavy Slam",
    "Wrap Assault", "Hail", "Leech Seed", "Fighting Will 1", "Aurora Blade", "Frostbite Sting",
    ],
    ultimate: ["Sleep Powder 1", "Sleep Powder 2", "Sleep Powder 3"],
  },
  Graycrene: {
    normal: [
    "Speed Rush", "Heavy Strike", "Gust", "Critical Focus", "Multi Twister", "Heavy Slam",
    "Gale Thrust", "Recover 2", "Cyclone Spiral", "Rally", "Quick Strike", "Heaven Crash",
    ],
    ultimate: ["Storm Tornado 1", "Storm Tornado 2", "Storm Tornado 3"],
  },
  Spikub: {
    normal: [
    "Tenacity", "Mega Smash", "Ambush", "Disarray", "Mud Slap", "Block", "Shock",
    "Savage Slam", "Earth Pulse", "Earthquake", "Immolate", "Fissure",
    ],
    ultimate: ["Sand Trap 1", "Sand Trap 2", "Sand Trap 3"],
  },
  Frostlet: {
    normal: [
    "Frostbite", "Flash Strike", "Ice Spike", "Glacial Spike", "Fighting Will 1", "Icy Wind",
    "Ice Ball", "Torment", "Hail", "Glacial", "Frost Strike", "Frostbite Sting",
    ],
    ultimate: ["Glacial Field 1", "Glacial Field 2", "Glacial Field 3"],
  },
  Gempillar: {
    normal: [
      "Heavy Strike", "Intimidate", "Insect Rush", "Tenacity", "Insect Sonic", "Poison Spike",
      "Heavy Slam", "Web Bind", "Inversion", "Wing Blade", "Rally", "Silkburst",
    ],
    ultimate: ["Swarm Assault 1", "Swarm Assault 2", "Swarm Assault 3"],
  },
  Tarro: {
    normal: [
      "Hone 1", "Heavy Strike", "Vine Drain", "Dragon Claw", "Fighting Will 1", "Seed Bomb",
      "Wrap Assault", "Horn Strike", "Energy Absorb", "Leech Seed", "Verdant Beam", "Dragon Pursuit",
    ],
    ultimate: ["Leaf Storm 1", "Leaf Storm 2", "Leaf Storm 3"],
  },
  Magma: {
    normal: [
      "Critical Focus", "Ram", "Flame Dance", "Fighting Will 1", "Dash Punch", "Protect",
      "Fireball Blast", "Burn", "Mirage", "Wildfire", "Unblemished Spirit", "Bloodflame",
    ],
    ultimate: ["Flame Devour 1", "Flame Devour 2", "Flame Devour 3"],
  },
  Boltonia: {
    normal: [
      "Flash Strike", "Lightning Shock", "Fighting Will 1", "Static Field", "Electrify", "Heavy Slam",
      "Protect", "Volt Dash", "Thunder Blast", "Full Purify", "Ion Purge", "Volt Overload",
    ],
    ultimate: ["Thunderous Roar 1", "Thunderous Roar 2", "Thunderous Roar 3"],
  },
  Arcub: {
    normal: [
      "Ram", "Lightning Shock", "Hone 1", "Static Field", "Electrify", "Chain Lightning",
      "Thor Power", "Lightning Blitz", "Volt Tempest", "Reckoning Strike", "Thunderstorm", "Thunder Retribution",
    ],
    ultimate: ["Lightning Surge 1", "Lightning Surge 2", "Lightning Surge 3"],
  },
  Starloop: {
    normal: [
      "Steady", "Tackle", "Psychic Blast", "Torment", "Mirage Beam", "Hallucination",
      "Power Strike", "Star Meteor", "Mind Insight", "Psychic Cast", "Rally", "Mind Disrupt",
    ],
    ultimate: ["Mind Burst 1", "Mind Burst 2", "Mind Burst 3"],
  },
  Tinkog: {
    normal: [
      "Tackle", "Iron Fortress", "Magnetic Field", "Encore", "Steel Resonance", "Wild Ram",
      "Protect", "Gear Grind", "Energy Absorb", "Kinetic Impact", "Charged Strike", "Thermal Ray",
    ],
    ultimate: ["Magnetic Storm 1", "Magnetic Storm 2", "Magnetic Storm 3"],
  },
  Snaero: {
    normal: [
      "Energy Absorb", "Ram", "Ice Spike", "Glacial", "Icy Wind", "Power Strike",
      "Snowfall", "Ice Ball", "Frost Strike", "Feral Unleash", "Myriad Frost", "Snow Lance",
    ],
    ultimate: ["Swift Freeze 1", "Swift Freeze 2", "Swift Freeze 3"],
  },
  Pummpaw: {
    normal: [
      "Restore", "Scratch", "Sonic Punch", "Intimidate", "Dash Punch", "Block",
      "Power Strike", "Sharp Claw", "Hone 1", "Elbow Smash", "Combo Punch", "Rider Kick",
    ],
    ultimate: ["Exploding Fist 1", "Exploding Fist 2", "Exploding Fist 3"],
  },
  Datubud: {
    normal: [
      "Fighting Will 1", "Tackle", "Psychic Blast", "Hallucination", "Mirage Beam", "Mega Drain",
      "Torment", "Star Meteor", "Psychic Cast", "Recover 1", "Mind Disrupt", "Blossom Strike",
    ],
    ultimate: ["Sleep Powder 1", "Sleep Powder 2", "Sleep Powder 3"],
  },
  Wispuff: {
    normal: [
      "Hone 1", "Ram", "Psychic Blast", "Poison", "Toxic Sting", "Hallucination",
      "Poison Coat", "Full Purify", "Venom Spray", "Psychic Cast", "Venom Burst", "Deadly Toxin",
    ],
    ultimate: ["Corrosive Smoke 1", "Corrosive Smoke 2", "Corrosive Smoke 3"],
  },
  Mudbud: {
    normal: [
      "Smoke Cover", "Mega Smash", "Leaf Blade", "Expose", "Seed Bomb", "Energy Absorb",
      "Earthquake", "Wrap Assault", "Rally", "Earth Pulse", "Quicksand", "Ruthless Rush",
    ],
    ultimate: ["Earth Fissure 1", "Earth Fissure 2", "Earth Fissure 3"],
  },
  Astraknight: {
    normal: [
      "Intimidate", "Scratch", "Sonic Punch", "Speed Rush", "Dash Punch", "Protect",
      "Sharp Claw", "True Hit", "Hone 1", "Elbow Smash", "Heavy Blow", "Multi Strike",
    ],
    ultimate: ["Ultimate Burst Fist 1", "Ultimate Burst Fist 2", "Ultimate Burst Fist 3"],
  },
  Celesthorn: {
    normal: [
      "Hallucination", "Tackle", "Psychic Blast", "Encore", "Mirage Beam", "Power Strike",
      "Star Meteor", "Shatter", "Psychic Cast", "Rally", "Psychic Crush", "Psychic Etch",
    ],
    ultimate: ["Implosion 1", "Implosion 2", "Implosion 3"],
  },
  Wispark: {
    normal: [
      "Hone 1", "Flash Strike", "Light Focus", "Radiance", "Light Pulse", "Power Strike",
      "Radiant Blade", "Full Purify", "Energy Flow", "Purge Beam", "Energy Absorb", "Radiance Cannon",
    ],
    ultimate: ["Sacred Baptism 1", "Sacred Baptism 2", "Sacred Baptism 3"],
  },
  Clipdow: {
    normal: [
      "Speed Rush", "Tackle", "Shadow Blast", "Torment", "Energy Siphon", "Shadow Ambush",
      "Power Strike", "Corrosion Fang", "Hone 1", "Nightfall Slash", "Energy Absorb", "Core Overdrive",
    ],
    ultimate: ["Shadow Reap 1", "Shadow Reap 2", "Shadow Reap 3"],
  },
  Clanx: {
    normal: [
      "Hone 1", "Iron Impact", "Magnetic Field", "Torment", "Energy Siphon", "Steel Resonance",
      "Gear Grind", "Shadow Ambush", "Protect", "Nightfall Slash", "Charged Strike", "Overload Smash",
    ],
    ultimate: ["Steel Smash 1", "Steel Smash 2", "Steel Smash 3"],
  },
  Frostin: {
    normal: [
      "Frostbite", "Ram", "Ice Spike", "Insect Rush", "Bug Drain", "Ice Ball",
      "Inversion", "Web Bind", "Snowfall", "Glacial", "Silkburst", "Snow Lance",
    ],
    ultimate: ["Frigid Force 1", "Frigid Force 2", "Frigid Force 3"],
  },
  Glowy: {
    normal: [
      "Hone 1", "Tackle", "Ambush", "Radiance", "Light Pulse", "Shock",
      "Power Strike", "Full Purify", "Energy Flow", "Quicksand", "Energy Absorb", "Radiance Cannon",
    ],
    ultimate: ["Core Shock 1", "Core Shock 2", "Core Shock 3"],
  },
  Cyanie: {
    normal: [
      "Iron Fortress", "Ram", "Lightning Shock", "Electrify", "Thunder Punch", "Savage Slam",
      "Sand Attack", "Sandstorm", "Lightning Blitz", "Fighting Will 1", "Earth Power", "Heaven's Thunder",
    ],
    ultimate: ["Prism Beam 1", "Prism Beam 2", "Prism Beam 3"],
  },
  Ignibud: {
    normal: [
      "Hone 1", "Ram", "Fire Strike", "Burn", "Cinder", "Mirage",
      "Power Strike", "Fireball Blast", "Cremate", "Spark Strike", "Skyfire", "Brands of Cinder",
    ],
    ultimate: ["Fire Rain 1", "Fire Rain 2", "Fire Rain 3"],
  },
};

// Unique learnable skills supplied for evolved forms are keyed to each line's
// base form so the normal inheritance pass exposes them to every evolution.
// These entries do not include invented unlock levels; the Wiki definitions
// still provide their type, description, power, uses, and classifications.
const SUPPLEMENTAL_UNIQUE_MOVES: Record<string, string[]> = {
  Blazpup: ["All-Out Attack", "Spark Strike", "Line Breaker"],
  Glaclide: ["Ice Beam", "All-Out Attack", "Combat Spirit"],
  Bluebird: ["Cyclone Spiral", "Lightning Storm", "Combat Spirit"],
  Graycrene: ["Dust Cyclone", "All-Out Attack", "Combat Spirit", "Air Slash"],
  Bubble: ["All-Out Attack", "Bubble Slam", "Combat Spirit"],
  Chitmite: ["Poison Gas", "Battle Stance", "Venom Chase"],
  Lavite: ["Dust Cyclone", "Spark Strike", "Line Breaker"],
  Frostlet: ["Ice Beam", "All-Out Attack", "Store Power"],
  Tarro: ["Giga Drain", "Dragon Breath", "Store Power"],
  Wispuff: ["Poison Gas", "Time Warp", "Combat Spirit"],
  Arcub: ["Lightning Storm", "All-Out Attack", "Bolt Strike", "Battle Stance"],
  Pummpaw: ["Mega Claw", "All-Out Attack", "Battle Stance"],
  Gempillar: ["All-Out Attack", "Venom Chase", "Store Power"],
  Datubud: ["Giga Drain", "Time Warp", "Store Power"],
  Mudbud: ["Caltrop", "Giga Drain", "Combat Spirit"],
  Pebble: ["All-Out Attack", "Dust Cyclone", "Line Breaker"],
  Spikub: ["Caltrop", "All-Out Attack", "Line Breaker"],
  Fluffet: ["All-Out Attack", "Dust Cyclone", "Line Breaker"],
  Chirppy: ["Cyclone Spiral", "All-Out Attack", "Battle Stance"],
  Gulpfish: ["Caltrop", "Bubble Slam", "Store Power"],
  Wispark: ["Dawnstrike", "All-Out Attack", "Store Power"],
  Clanx: ["Shadow Stab", "Neutron Pulse", "Line Breaker"],
  Clipdow: ["All-Out Attack", "Line Breaker", "Shadow Stab"],
  Glowy: ["Dawnstrike", "Caltrop", "Store Power"],
  Mopebun: ["Dust Cyclone", "Caltrop", "Combat Spirit"],
  Clampip: ["All-Out Attack", "Bubble Slam", "Battle Stance"],
  Sparkit: ["All-Out Attack", "Spark Strike", "Store Power"],
  Stardrift: ["Ice Beam", "Combat Spirit", "Giga Drain"],
  Tinkog: ["Neutron Pulse", "All-Out Attack", "Line Breaker"],
  Humding: ["Cyclone Spiral", "Venom Chase", "Battle Stance"],
  Ignibud: ["Venom Chase", "Ice Beam", "Combat Spirit"],
  Budling: ["Giga Drain", "All-Out Attack", "Store Power"],
  Vipip: ["Poison Gas", "All-Out Attack", "Battle Stance"],
  Starloop: ["All-Out Attack", "Store Power", "Time Warp"],
  Leafbun: ["All-Out Attack", "Giga Drain", "Combat Spirit"],
  Coulomb: ["Lightning Storm", "All-Out Attack", "Store Power"],
  Cyanie: ["Dust Cyclone", "Lightning Storm", "Store Power"],
  Astraknight: ["All-Out Attack", "Mega Claw", "Battle Stance"],
  Celesthorn: ["Time Warp", "All-Out Attack", "Combat Spirit"],
  Magma: ["Spark Strike", "Mega Claw", "Line Breaker"],
  Snaero: ["Ice Beam", "All-Out Attack", "Battle Stance"],
  Frostin: ["Venom Chase", "Ice Beam", "Combat Spirit"],
  Boltonia: ["All-Out Attack", "Lightning Storm", "Combat Spirit"],
  Silvanarch: ["Giga Drain", "All-Out Attack", "Store Power"],
};

let cachedCatalog: unknown;
let cachedAt = 0;
let refreshInFlight: Promise<unknown> | null = null;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStats(value: unknown): StatBlock {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => asNumber(entry[1]) !== undefined),
  );
}

function absoluteUrl(value: unknown): string | null {
  const url = asString(value);
  if (!url) return null;
  return url.startsWith("http") ? url : `${WIKI_ORIGIN}${url}`;
}

function extractJsonValue(text: string, start: number): unknown {
  const opening = text[start];
  if (opening !== "{" && opening !== "[") return undefined;
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") quoted = false;
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === opening) depth += 1;
    else if (char === closing) {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  return undefined;
}

function rscFromHtml(html: string): string {
  const scripts = html.matchAll(/self\.__next_f\.push\(\[1,(.*?)\]\)<\/script>/g);
  const chunks: string[] = [];
  for (const match of scripts) {
    try {
      const decoded = JSON.parse(match[1]);
      if (typeof decoded === "string") chunks.push(decoded);
    } catch {
      // A malformed streaming chunk can be ignored; the rest of the page remains usable.
    }
  }
  return chunks.join("\n");
}

async function fetchRsc(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "Evomon Field Guide / public wiki reader" },
  });
  if (!response.ok) throw new Error(`Wiki request failed (${response.status})`);
  return rscFromHtml(await response.text());
}

function getRscObject(rsc: string, key: string): JsonObject | undefined {
  const keyIndex = rsc.indexOf(key);
  if (keyIndex < 0) return undefined;
  const start = rsc.lastIndexOf("{", keyIndex);
  const value = start >= 0 ? extractJsonValue(rsc, start) : undefined;
  return isObject(value) ? value : undefined;
}

function stageLabel(value: unknown): string {
  if (value === "base") return "Base form";
  if (value === "stage2") return "Stage 2";
  if (value === "stage3plus") return "Stage 3+";
  return asString(value) ?? "Unclassified";
}

function wikiSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tagsForMove(category: string, description: string): MoveTag[] {
  const tags: MoveTag[] = [];
  if (category === "physical") tags.push("Physical");
  if (category === "special") tags.push("Sp. Atk");

  const isSupport = /\b(?:buff|debuff|stat(?:s| stage| stages| boost| boosts| decrease| decreases)?|raises?|lowers?|increases?|decreases?|boosts?|gains?|restores?|heals?|doubles?)\b/i.test(description);
  if (isSupport) tags.push("Support");

  if (/\bpriority\b/i.test(description)) tags.push("Priority");

  const hasConditionToken = /\[(?:burn|bleed|blind|confusion|freeze|frostbite|paralysis|poison|psymark|sleep|stun|torment)\]/i.test(description);
  const changesCondition = /\b(?:inflict|inflicts|inflicting|give|gives|giving|apply|applies|applying|cause|causes|causing|set|sets|setting|double|doubles|doubling|remove|removes|removing|cure|cures|curing)\b/i.test(description);
  const hasStatusCondition = hasConditionToken && changesCondition;
  if (hasStatusCondition) tags.push("Status condition");

  const changesWeather = /\bweather\b|\[(?:rain|snow|sandstorm|thunderstorm|volcanic eruption)\]/i.test(description);
  if (changesWeather) tags.push("Weather");

  const isArea = /\b(?:all|every|both)\s+(?:targets?|foes?|enemies|evomons?|allies)\b|\barea\b/i.test(description);
  const isSingle = /\b(?:one|the|a single)\s+(?:target|foe|enemy|ally)\b|\byour evomon\b/i.test(description);
  if (isArea) tags.push("AoE");
  else if (isSingle || (!changesWeather && (category === "physical" || category === "special" || category === "status"))) tags.push("Single target");

  return tags;
}

function asMoveDefinition(value: JsonObject): Omit<CatalogMove, "unlockLevel" | "slot"> | undefined {
  const name = asString(value.name);
  const element = asString(value.type);
  const category = asString(value.category);
  const description = asString(value.description);
  if (!name || !element || !category || !description) return undefined;
  return {
    name,
    element,
    category,
    description,
    obtained: asString(value.obtain) ?? null,
    power: asString(value.power) ?? null,
    uses: asNumber(value.uses) ?? null,
    tags: tagsForMove(category.toLowerCase(), description),
  };
}

async function getDetail(slug: string): Promise<{ line: string[]; shinyStats?: StatBlock }> {
  const rsc = await fetchRsc(`${WIKI_URL}/${encodeURIComponent(slug)}`);
  const lineIndex = rsc.indexOf("\"line\":[");
  const rawLine = lineIndex < 0
    ? []
    : extractJsonValue(rsc, rsc.indexOf("[", lineIndex));
  const line = Array.isArray(rawLine)
    ? rawLine
        .filter(isObject)
        .map((entry) => asString(entry.name))
        .filter((name): name is string => Boolean(name))
    : [];

  const statsIndex = rsc.indexOf("\"shinyStats\"");
  const cardStart = statsIndex < 0 ? -1 : rsc.lastIndexOf("{\"name\":", statsIndex);
  const variantCard = cardStart < 0 ? undefined : extractJsonValue(rsc, cardStart);
  const shinyStats = isObject(variantCard) ? asStats(variantCard.shinyStats) : undefined;

  return { line, shinyStats: shinyStats && Object.keys(shinyStats).length ? shinyStats : undefined };
}

async function createCatalog(): Promise<unknown> {
  const [wikiRsc, traitsRsc, movesRsc] = await Promise.all([
    fetchRsc(WIKI_URL),
    fetchRsc(TRAITS_URL),
    fetchRsc(MOVES_URL),
  ]);
  const petsIndex = wikiRsc.indexOf("\"initialPets\":[");
  const rawPets = petsIndex < 0
    ? []
    : extractJsonValue(wikiRsc, wikiRsc.indexOf("[", petsIndex));
  if (!Array.isArray(rawPets)) throw new Error("Evomon Wiki catalog format was not recognised");

  const traitsData = getRscObject(traitsRsc, "\"traits\":[");
  const traits = Array.isArray(traitsData?.traits) ? traitsData.traits.filter(isObject) : [];
  const legendaryEffects = new Map(
    traits
      .filter((trait) => trait.rarity === "legendary")
      .map((trait) => [asString(trait.name), asString(trait.description)] as const)
      .filter((trait): trait is readonly [string, string] => Boolean(trait[0] && trait[1])),
  );
  const legendaryByMonster = new Map<string, readonly [string, string][]>();
  const monstersByTrait = isObject(traitsData?.monsters) ? traitsData.monsters : {};
  for (const [traitSlug, entries] of Object.entries(monstersByTrait)) {
    const effect = [...legendaryEffects.entries()].find(([name]) => wikiSlug(name) === traitSlug);
    if (!effect || !Array.isArray(entries)) continue;
    for (const monster of entries.filter(isObject)) {
      const slug = asString(monster.slug);
      if (!slug) continue;
      legendaryByMonster.set(slug, [...(legendaryByMonster.get(slug) ?? []), effect]);
    }
  }

  const movesData = getRscObject(movesRsc, "\"moves\":[");
  const moveDefinitions = new Map<string, Omit<CatalogMove, "unlockLevel" | "slot">>();
  const rawMoves = Array.isArray(movesData?.moves) ? movesData.moves.filter(isObject) : [];
  for (const rawMove of rawMoves) {
    const move = asMoveDefinition(rawMove);
    if (move) moveDefinitions.set(move.name, move);
  }
  moveDefinitions.set("Volt Dash", {
    name: "Volt Dash",
    element: "electric",
    category: "special",
    description: "Deals Special Damage to the target.",
    obtained: null,
    power: "85",
    uses: 15,
    tags: tagsForMove("special", "Deals Special Damage to the target."),
  });

  const movesByMonster = new Map<string, CatalogMove[]>();
  const moveLinks = Array.isArray(movesData?.links) ? movesData.links.filter(isObject) : [];
  const petsByName = new Map(
    rawPets
      .filter(isObject)
      .map((pet) => [asString(pet.name), pet] as const)
      .filter((entry): entry is readonly [string, JsonObject] => Boolean(entry[0])),
  );
  for (const [baseName, moveList] of Object.entries(SUPPLEMENTAL_BASE_MOVES)) {
    const basePet = petsByName.get(baseName);
    if (!basePet) continue;
    moveList.normal.forEach((moveName, index) => {
      moveLinks.push({
        petId: asString(basePet.id) ?? wikiSlug(baseName),
        moveName,
        slot: "level",
        learnLevel: MOVE_LEVELS[index],
      });
    });
    moveList.ultimate.forEach((moveName, index) => {
      moveLinks.push({
        petId: asString(basePet.id) ?? wikiSlug(baseName),
        moveName,
        slot: "ultimate",
        learnLevel: ULTIMATE_LEVELS[index],
      });
    });
  }
  for (const [baseName, moveNames] of Object.entries(SUPPLEMENTAL_UNIQUE_MOVES)) {
    const basePet = petsByName.get(baseName);
    if (!basePet) continue;
    for (const moveName of moveNames) {
      moveLinks.push({
        petId: asString(basePet.id) ?? wikiSlug(baseName),
        moveName,
        slot: "level",
        learnLevel: null,
      });
    }
  }
  for (const link of moveLinks) {
    const petId = asString(link.petId);
    const moveName = asString(link.moveName);
    const definition = moveName ? moveDefinitions.get(moveName) : undefined;
    if (!petId || !moveName || !definition) continue;
    const move: CatalogMove = {
      ...definition,
      unlockLevel: asNumber(link.learnLevel) ?? null,
      slot: asString(link.slot) ?? "level",
    };
    movesByMonster.set(petId, [...(movesByMonster.get(petId) ?? []), move]);
  }
  for (const [petId, moves] of movesByMonster) {
    movesByMonster.set(
      petId,
      moves.sort((a, b) =>
        Number(a.slot === "ultimate") - Number(b.slot === "ultimate")
        || (a.unlockLevel ?? Number.POSITIVE_INFINITY) - (b.unlockLevel ?? Number.POSITIVE_INFINITY)
        || a.name.localeCompare(b.name)),
    );
  }

  const pets = rawPets.filter(isObject);
  const details = new Map<string, { line: string[]; shinyStats?: StatBlock }>();
  const batches = Array.from({ length: Math.ceil(pets.length / 10) }, (_, index) => pets.slice(index * 10, index * 10 + 10));
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (pet) => {
        const id = asString(pet.id);
        const name = asString(pet.name);
        if (!id || !name) return undefined;
        try {
          return [id, await getDetail(wikiSlug(name))] as const;
        } catch {
          return [id, { line: [] as string[] }] as const;
        }
      }),
    );
    for (const item of results) if (item) details.set(item[0], item[1]);
  }

  const directTraitsByName = new Map<string, readonly [string, string][]>();
  const traitsById = new Map<string, readonly [string, string][]>();
  for (const pet of pets) {
    const id = asString(pet.id);
    const name = asString(pet.name);
    if (!id || !name) continue;
    const directTraits = legendaryByMonster.get(wikiSlug(name)) ?? legendaryByMonster.get(id) ?? [];
    directTraitsByName.set(wikiSlug(name), directTraits);
    traitsById.set(id, directTraits);
  }

  const lineTraitsById = new Map<string, readonly [string, string][]>();
  for (const pet of pets) {
    const id = asString(pet.id);
    const name = asString(pet.name);
    if (!id || !name) continue;
    const line = details.get(id)?.line.length ? details.get(id)?.line ?? [] : [name];
    const inheritedTraits = line.flatMap((lineName) => directTraitsByName.get(wikiSlug(lineName)) ?? []);
    const uniqueTraits = [...new Map(inheritedTraits.map((trait) => [trait[0], trait] as const)).values()];
    lineTraitsById.set(id, uniqueTraits.length ? uniqueTraits : traitsById.get(id) ?? []);
  }

  const mons = pets
    .map((pet) => {
      const id = asString(pet.id);
      const dexNumber = asNumber(pet.dexNumber);
      const name = asString(pet.name);
      if (!id || dexNumber === undefined || !name) return undefined;
      const normalStats = asStats(pet.baseStats);
      const detail = details.get(id);
      const traitsForMonster = lineTraitsById.get(id) ?? [];
      const traitNames = traitsForMonster.map(([trait]) => trait).join(" · ") || null;
      const traitEffects = traitsForMonster.map(([, effect]) => effect).join(" ") || null;
      const primary = asString(pet.element);
      const secondary = asString(pet.element2);
      return {
        id,
        dexNumber,
        name,
        element: [primary, secondary].filter((element): element is string => Boolean(element)),
        stage: stageLabel(pet.stage),
        image: absoluteUrl(pet.imageUrl),
        shinyImage: absoluteUrl(pet.shinyImageUrl),
        baseStats: normalStats,
        shinyBaseStats: detail?.shinyStats ?? normalStats,
        shinyStatsRecorded: Boolean(detail?.shinyStats),
        legendaryTrait: traitNames,
        legendaryTraitEffect: traitEffects,
        catchLocation: asString(pet.location)?.trim() || "Not recorded in current wiki notes",
        eventStatus: pet.isEvent === true ? "Event content" : "Standard content",
        evolutionLine: detail?.line.length ? detail.line : [name],
        moves: movesByMonster.get(id) ?? movesByMonster.get(wikiSlug(name)) ?? [],
        sourceUrl: `${WIKI_URL}/${encodeURIComponent(wikiSlug(name))}`,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => a.dexNumber - b.dexNumber);

  const moveSources = mons.filter(
    (mon) => mon.moves.length > 0 && mon.evolutionLine[0] === mon.name,
  );
  for (const base of moveSources) {
    for (const lineName of base.evolutionLine.slice(1)) {
      const lineMember = mons.find((mon) => mon.name === lineName);
      if (!lineMember) continue;
      const existingNames = new Set(lineMember.moves.map((move) => `${move.slot}:${move.name}:${move.unlockLevel}`));
      for (const move of base.moves) {
        const key = `${move.slot}:${move.name}:${move.unlockLevel}`;
        if (!existingNames.has(key)) lineMember.moves.push(move);
      }
      lineMember.moves.sort((a, b) =>
        Number(a.slot === "ultimate") - Number(b.slot === "ultimate")
        || (a.unlockLevel ?? Number.POSITIVE_INFINITY) - (b.unlockLevel ?? Number.POSITIVE_INFINITY)
        || a.name.localeCompare(b.name));
    }
  }

  return GetEvomonCatalogResponse.parse({
    source: WIKI_URL,
    traitsSource: TRAITS_URL,
    movesSource: MOVES_URL,
    fetchedAt: new Date().toISOString(),
    mons,
  });
}

async function currentCatalog(): Promise<unknown> {
  if (cachedCatalog && Date.now() - cachedAt < CACHE_MS) return cachedCatalog;
  if (!refreshInFlight) {
    refreshInFlight = createCatalog()
      .then((catalog) => {
        cachedCatalog = catalog;
        cachedAt = Date.now();
        return catalog;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

const router: IRouter = Router();

router.get("/evomon", async (req, res): Promise<void> => {
  try {
    const catalog = await currentCatalog();
    req.log.info({ count: isObject(catalog) && Array.isArray(catalog.mons) ? catalog.mons.length : 0 }, "Evomon catalog served");
    res.json(catalog);
  } catch (error) {
    req.log.error({ err: error }, "Evomon catalog refresh failed");
    res.status(502).json({ error: "The Evomon Wiki could not be reached. Please try again shortly." });
  }
});

export default router;
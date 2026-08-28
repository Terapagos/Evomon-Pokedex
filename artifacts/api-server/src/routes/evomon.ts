import { Router, type IRouter } from "express";
import { GetEvomonCatalogResponse } from "@workspace/api-zod";

const WIKI_ORIGIN = "https://www.evomon.wiki";
const WIKI_URL = `${WIKI_ORIGIN}/wiki`;
const TRAITS_URL = `${WIKI_ORIGIN}/traits`;
const MOVES_URL = `${WIKI_ORIGIN}/moves`;
const CACHE_MS = 1000 * 60 * 60 * 6;

type JsonObject = Record<string, unknown>;
type StatBlock = Record<string, number>;
type MoveTag = "Physical" | "Sp. Atk" | "Support" | "Status condition" | "Weather" | "AoE" | "Single target";

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

  const movesByMonster = new Map<string, CatalogMove[]>();
  const moveLinks = Array.isArray(movesData?.links) ? movesData.links.filter(isObject) : [];
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
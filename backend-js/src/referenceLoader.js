// loads recorded reference stroke data for each fidel character
// single-sample (reference_data/) and multi-sample (reference_data_multi/, 5 per char) variants

import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_DATA_DIR = join(__dirname, "reference_data");
const MULTI_REFERENCE_DATA_DIR = join(__dirname, "reference_data_multi");

const cache = new Map();
const multiCache = new Map();

function assertSafeId(romanization) {
  if (romanization.includes("/") || romanization.includes("\\") || romanization.includes("..")) {
    throw new Error(`Invalid character identifier: ${romanization}`);
  }
}

export function loadReference(romanization) {
  if (cache.has(romanization)) return cache.get(romanization);

  assertSafeId(romanization);
  const path = join(REFERENCE_DATA_DIR, `${romanization}.json`);
  if (!existsSync(path)) return null;

  const data = JSON.parse(readFileSync(path, "utf-8"));
  cache.set(romanization, data);
  return data;
}

export function listAvailableCharacters() {
  if (!existsSync(REFERENCE_DATA_DIR)) return [];
  return readdirSync(REFERENCE_DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

// {romanization, character} pairs so the frontend can show the glyph without a round trip
export function listAvailableCharactersWithGlyphs() {
  return listAvailableCharacters().map((romanization) => {
    const data = loadReference(romanization);
    return { romanization, character: data.character };
  });
}

// returns all 5 recorded samples for a character, used by the multi-sample
// verification in scoring.js instead of comparing against just one reference
export function loadReferenceMulti(romanization) {
  if (multiCache.has(romanization)) return multiCache.get(romanization);

  assertSafeId(romanization);
  const charDir = join(MULTI_REFERENCE_DATA_DIR, romanization);
  if (!existsSync(charDir)) return null;

  const sampleFiles = readdirSync(charDir)
    .filter((f) => f.startsWith("sample_") && f.endsWith(".json"))
    .sort();

  const samples = sampleFiles.map((f) => JSON.parse(readFileSync(join(charDir, f), "utf-8")));
  multiCache.set(romanization, samples);
  return samples;
}

// recorded path stripped of timestamps, for the frontend to draw as the tracing guide --
// using the real reference shape (not a font glyph) means what you trace is what gets scored
export function loadGuideStrokes(romanization) {
  const samples = loadReferenceMulti(romanization);
  if (!samples || samples.length === 0) return null;

  return samples[0].strokes.map((stroke) => stroke.map((p) => ({ x: p.x, y: p.y })));
}

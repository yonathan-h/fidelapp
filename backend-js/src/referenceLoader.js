// loads the recorded (DTW-averaged consensus) reference stroke data for each fidel
// character -- the single source of truth for the guide, feedback, and pass/fail.
// reference_data_multi/ (the raw per-sample recordings this consensus is built from)
// is offline-only data now: scripts/regenerate-reference-averages.js and
// scripts/validate-single-reference-scoring.js read it directly, not through this module.

import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_DATA_DIR = join(__dirname, "reference_data");

const cache = new Map();

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

// recorded path for the frontend to draw as the tracing guide -- sourced from the single
// reference (reference_data/), which is a DTW-averaged consensus of the 5 recorded samples
// (see backend-js/scripts/regenerate-reference-averages.js), not any one raw recording.
// this is also what detailed feedback and strokeOrderScore compare against, so what you
// trace is, by construction, what gets scored -- same principle as using real recorded
// strokes instead of a font glyph, just applied one level further. timestamps are kept,
// rebased to milliseconds relative to the first point of the first stroke, so the frontend
// can replay the character being drawn at (a clamped version of) its original pace
export function loadGuideStrokes(romanization) {
  const reference = loadReference(romanization);
  if (!reference) return null;

  const strokes = reference.strokes;
  const t0 = strokes[0]?.[0]?.t ?? 0;
  return strokes.map((stroke) => stroke.map((p) => ({ x: p.x, y: p.y, t: (p.t - t0) * 1000 })));
}

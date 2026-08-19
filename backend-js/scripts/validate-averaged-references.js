// sanity check for regenerate-reference-averages.js: for every character, scores the new
// averaged reference_data/<char>.json against each of its raw reference_data_multi samples
// (using the actual production shapeScore function), and compares against what the OLD
// single-sample reference_data would have scored -- confirms averaging is actually a better
// representative of the 5 samples, not just a different one
import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { shapeScore } from "../src/scoring.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");
const NEW_DIR = join(__dirname, "..", "src", "reference_data");

function loadSamples(romanization) {
  const charDir = join(MULTI_DIR, romanization);
  return readdirSync(charDir)
    .filter((f) => f.startsWith("sample_") && f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(charDir, f), "utf-8")));
}

function loadOldReference(romanization) {
  const relPath = `backend-js/src/reference_data/${romanization}.json`;
  const content = execSync(`git show HEAD:"${relPath}"`, { cwd: join(__dirname, "..", ".."), encoding: "utf-8" });
  return JSON.parse(content);
}

const characters = readdirSync(MULTI_DIR).sort();
let newTotal = 0;
let oldTotal = 0;
let newWorseCount = 0;
const worst = [];

for (const romanization of characters) {
  const samples = loadSamples(romanization);
  const newRef = JSON.parse(readFileSync(join(NEW_DIR, `${romanization}.json`), "utf-8"));
  const oldRef = loadOldReference(romanization);

  const newScores = samples.map((s) => shapeScore(newRef.strokes, s.strokes));
  const oldScores = samples.map((s) => shapeScore(oldRef.strokes, s.strokes));

  const newAvg = newScores.reduce((a, b) => a + b, 0) / newScores.length;
  const oldAvg = oldScores.reduce((a, b) => a + b, 0) / oldScores.length;

  newTotal += newAvg;
  oldTotal += oldAvg;
  if (newAvg < oldAvg) {
    newWorseCount++;
    worst.push({ romanization, newAvg: newAvg.toFixed(1), oldAvg: oldAvg.toFixed(1) });
  }
}

console.log(`Characters checked: ${characters.length}`);
console.log(`Average shape-score-vs-own-samples -- OLD (single sample): ${(oldTotal / characters.length).toFixed(2)}`);
console.log(`Average shape-score-vs-own-samples -- NEW (dtw average):   ${(newTotal / characters.length).toFixed(2)}`);
console.log(`Characters where NEW scored lower than OLD: ${newWorseCount}`);
if (worst.length > 0) {
  console.log("Worst regressions:");
  worst
    .sort((a, b) => b.oldAvg - b.newAvg - (a.oldAvg - a.newAvg))
    .slice(0, 10)
    .forEach((w) => console.log(`  ${w.romanization}: old=${w.oldAvg} new=${w.newAvg}`));
}

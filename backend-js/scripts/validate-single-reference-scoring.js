// validates a candidate simplification to the pass/fail path: scoring a live attempt's
// shape against the single committed DTW-averaged consensus reference (shapeScore),
// instead of the current production path (scoreAttemptMulti's best-3-of-5 ensemble over
// the raw reference_data_multi/ samples). both functions are used unmodified -- this
// script only decides which one should be the authoritative pass/fail signal.
//
// methodology mirrors the existing calibration scripts (validate-averaged-references.js):
// each raw recorded sample stands in for a genuine held-out attempt, scored both ways,
// plus a wrong-character negative control using the same adjacent-pairing approach
// already used to calibrate shapeScore's IoU multiplier.
//
// run once via: node scripts/validate-single-reference-scoring.js
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { shapeScore, scoreAttemptMulti } from "../src/scoring.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");
const REFERENCE_DIR = join(__dirname, "..", "src", "reference_data");
const PASS_THRESHOLD = 70;
const REGRESSION_GAP = 15; // flag a held-out sample if "single" scores this much lower than "ensemble"

function loadSamples(romanization) {
  const charDir = join(MULTI_DIR, romanization);
  return readdirSync(charDir)
    .filter((f) => f.startsWith("sample_") && f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(charDir, f), "utf-8")));
}

function loadConsensus(romanization) {
  return JSON.parse(readFileSync(join(REFERENCE_DIR, `${romanization}.json`), "utf-8"));
}

const characters = readdirSync(MULTI_DIR).sort();

let ensembleTotal = 0;
let singleTotal = 0;
let count = 0;
let ensembleFailures = 0;
let singleFailures = 0;
const regressions = [];

for (const romanization of characters) {
  const samples = loadSamples(romanization);
  const consensus = loadConsensus(romanization);

  // leave-one-out: each sample stands in for a held-out attempt, never compared to itself
  for (let i = 0; i < samples.length; i++) {
    const heldOut = samples[i];
    const others = samples.filter((_, j) => j !== i);

    const ensembleScore = scoreAttemptMulti(others, heldOut.strokes).shapeScore;
    const singleScore = shapeScore(consensus.strokes, heldOut.strokes);

    ensembleTotal += ensembleScore;
    singleTotal += singleScore;
    count++;

    if (ensembleScore < PASS_THRESHOLD) ensembleFailures++;
    if (singleScore < PASS_THRESHOLD) singleFailures++;
    if (ensembleScore - singleScore > REGRESSION_GAP) {
      regressions.push({ romanization, sample: i, ensembleScore, singleScore });
    }
  }
}

console.log(`Genuine-sample comparison across ${characters.length} characters, ${count} held-out samples:`);
console.log(
  `  Ensemble (current, best-3-of-N-1 raw samples): avg ${(ensembleTotal / count).toFixed(2)}, ` +
    `${ensembleFailures} below threshold (${((ensembleFailures / count) * 100).toFixed(1)}%)`
);
console.log(
  `  Single (candidate, vs consensus reference):    avg ${(singleTotal / count).toFixed(2)}, ` +
    `${singleFailures} below threshold (${((singleFailures / count) * 100).toFixed(1)}%)`
);

if (regressions.length > 0) {
  console.log(`\n${regressions.length} sample(s) where single scored >${REGRESSION_GAP}pts lower than ensemble:`);
  regressions
    .sort((a, b) => b.ensembleScore - b.singleScore - (a.ensembleScore - a.singleScore))
    .slice(0, 20)
    .forEach((r) =>
      console.log(`  ${r.romanization} sample ${r.sample}: ensemble=${r.ensembleScore.toFixed(1)} single=${r.singleScore.toFixed(1)}`)
    );
} else {
  console.log("\nNo notable regressions -- single tracks the ensemble closely on every held-out sample.");
}

// negative control: each character's consensus against the next character's raw samples
// (same adjacent-pairing approach already used to calibrate shapeScore's multiplier) --
// confirms "single" doesn't newly pass wrong-character attempts
let singleFalsePositives = 0;
let ensembleFalsePositives = 0;
let negativeCount = 0;
for (let i = 0; i < characters.length; i++) {
  const a = characters[i];
  const b = characters[(i + 1) % characters.length];
  if (a === b) continue;

  const consensusA = loadConsensus(a);
  const samplesA = loadSamples(a);
  for (const sample of loadSamples(b)) {
    negativeCount++;
    if (shapeScore(consensusA.strokes, sample.strokes) >= PASS_THRESHOLD) singleFalsePositives++;
    // same comparison under the CURRENT production method, so a high single-reference
    // rate can be told apart from a rate the ensemble already has today (alphabetically
    // adjacent romanizations are often the same consonant family with a different vowel,
    // e.g. "ba"/"be" -- genuinely similar shapes, not an arbitrary wrong-character pair)
    if (scoreAttemptMulti(samplesA, sample.strokes).shapeScore >= PASS_THRESHOLD) ensembleFalsePositives++;
  }
}

console.log(`\nNegative control (adjacent-romanization pairs, often same consonant family), ${negativeCount} comparisons:`);
console.log(`  Ensemble (current): ${ensembleFalsePositives} incorrectly scored >= ${PASS_THRESHOLD} (${((ensembleFalsePositives / negativeCount) * 100).toFixed(2)}%)`);
console.log(`  Single (candidate): ${singleFalsePositives} incorrectly scored >= ${PASS_THRESHOLD} (${((singleFalsePositives / negativeCount) * 100).toFixed(2)}%)`);

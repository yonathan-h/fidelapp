// regenerates reference_data/<char>.json (the single-reference file used for the frontend
// guide, detailed feedback, and strokeOrderScore) as a DTW-averaged consensus of that
// character's 5 (or 6) independently recorded samples in reference_data_multi/, instead of
// one arbitrary single recording. averaging cancels out each sample's own hand-tremor/
// imprecision far better than smoothing a single sample can -- what doesn't average out is
// a systematic issue shared by every sample, which would need re-recording, not this script.
//
// reference_data_multi/ itself is left untouched -- it stays the raw independent recordings
// used for the tolerant best-3-of-5 pass/fail check, which intentionally wants real variance.
//
// run once via: node scripts/regenerate-reference-averages.js
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { dtwAlignmentPath } from "../src/dtw.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");
const OUTPUT_DIR = join(__dirname, "..", "src", "reference_data");

function loadSamples(romanization) {
  const charDir = join(MULTI_DIR, romanization);
  const sampleFiles = readdirSync(charDir)
    .filter((f) => f.startsWith("sample_") && f.endsWith(".json"))
    .sort();
  return sampleFiles.map((f) => JSON.parse(readFileSync(join(charDir, f), "utf-8")));
}

function totalPointCount(sample) {
  return sample.strokes.reduce((sum, stroke) => sum + stroke.length, 0);
}

// the sample whose total point count is closest to the median -- used as the shape/pacing
// template so the averaged output isn't built on an unusually sparse or dense outlier
function pickTemplate(samples) {
  const counts = samples.map(totalPointCount).slice().sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  return samples.reduce((best, s) =>
    Math.abs(totalPointCount(s) - median) < Math.abs(totalPointCount(best) - median) ? s : best
  );
}

function strokeCentroid(stroke) {
  const xs = stroke.map((p) => p.x);
  const ys = stroke.map((p) => p.y);
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

// reorders otherStrokes to best match templateStrokes' order, by centroid distance --
// stroke *count* is consistent per character (audited separately), but stroke *order*
// isn't always: e.g. "pu" has two short strokes recorded in a different order across
// takes, so naively averaging "stroke index 2 of every sample" blends two differently-
// shaped strokes into a corrupted blob. brute-force is fine here -- max 5 strokes means
// at most 120 permutations, and this only runs offline
function matchStrokeOrder(templateStrokes, otherStrokes) {
  const templateCentroids = templateStrokes.map(strokeCentroid);
  const otherCentroids = otherStrokes.map(strokeCentroid);
  const indices = otherStrokes.map((_, i) => i);

  let bestPerm = indices;
  let bestCost = Infinity;
  for (const perm of permutations(indices)) {
    let cost = 0;
    for (let k = 0; k < perm.length; k++) {
      const [tx, ty] = templateCentroids[k];
      const [ox, oy] = otherCentroids[perm[k]];
      cost += Math.hypot(tx - ox, ty - oy);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestPerm = perm;
    }
  }
  return bestPerm.map((i) => otherStrokes[i]);
}

// averages one stroke across all samples, aligned to the template's own points via DTW --
// for each template point, every other sample contributes the (possibly several, if the
// warping path folds multiple of its points onto this one) point(s) it aligns to, averaged
// in first so a locally denser sample doesn't get extra weight
function averageStroke(templateStroke, otherStrokes) {
  const templatePoints = templateStroke.map((p) => [p.x, p.y]);
  const sums = templatePoints.map((p) => [...p]);
  const counts = templatePoints.map(() => 1);

  for (const otherStroke of otherStrokes) {
    const otherPoints = otherStroke.map((p) => [p.x, p.y]);
    const { path } = dtwAlignmentPath(templatePoints, otherPoints);

    const buckets = templatePoints.map(() => []);
    for (const [i, j] of path) buckets[i].push(otherPoints[j]);

    buckets.forEach((bucket, i) => {
      if (bucket.length === 0) return;
      const avgX = bucket.reduce((s, p) => s + p[0], 0) / bucket.length;
      const avgY = bucket.reduce((s, p) => s + p[1], 0) / bucket.length;
      sums[i][0] += avgX;
      sums[i][1] += avgY;
      counts[i] += 1;
    });
  }

  return templateStroke.map((p, i) => ({
    x: Math.round((sums[i][0] / counts[i]) * 100) / 100,
    y: Math.round((sums[i][1] / counts[i]) * 100) / 100,
    t: p.t, // pacing comes from the template alone -- averaging timestamps isn't worth the complexity
  }));
}

function averageCharacter(samples) {
  const template = pickTemplate(samples);
  const others = samples
    .filter((s) => s !== template)
    .map((s) => matchStrokeOrder(template.strokes, s.strokes));

  const strokes = template.strokes.map((templateStroke, k) =>
    averageStroke(
      templateStroke,
      others.map((otherStrokes) => otherStrokes[k])
    )
  );

  return {
    character: template.character,
    romanization: template.romanization,
    canvas_size: template.canvas_size,
    derived: `dtw_average_of_${samples.length}_samples`,
    generated_at: new Date().toISOString(),
    strokes,
  };
}

const characters = readdirSync(MULTI_DIR).sort();
for (const romanization of characters) {
  const samples = loadSamples(romanization);
  const averaged = averageCharacter(samples);
  writeFileSync(join(OUTPUT_DIR, `${romanization}.json`), JSON.stringify(averaged, null, 2) + "\n");
}

console.log(`Regenerated ${characters.length} reference files from their DTW-averaged samples.`);

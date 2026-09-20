import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shapeScore, strokeOrderScore, scoreAttempt } from "../src/scoring.js";
import { listAvailableCharacters, loadReference } from "../src/referenceLoader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");

// small helpers for building strokes without hand-typing coordinate lists --
// a straight segment sampled into `steps` points, {x, y} only since scoring.js
// never reads the timestamp
function line(x1, y1, x2, y2, steps = 20) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return points;
}

function reversed(points) {
  return [...points].reverse();
}

// a simple two-stroke "L": down, then right
const L_SHAPE = [line(0, 0, 0, 100), line(0, 100, 100, 100)];
const VERTICAL_LINE = [line(50, 0, 50, 100)];
const HORIZONTAL_LINE = [line(0, 50, 100, 50)];

describe("shapeScore", () => {
  test("identical strokes score at or near 100", () => {
    assert.ok(shapeScore(L_SHAPE, L_SHAPE) >= 95);
  });

  test("regression test: a correctly-shaped attempt drawn at a different size/position still scores highly", () => {
    // this is the exact bug fixed earlier in the project -- shapeScore used to
    // normalize by canvas-size ratio, which assumed the reference and the attempt
    // filled the same proportion of their canvas. own-bounding-box normalization
    // (centerAndScaleToOwnBBox in scoring.js) makes this genuinely scale/position
    // invariant, which this test locks in
    const scaledAndShifted = [line(2000, 5000, 2000, 5300), line(2000, 5300, 2300, 5300)];
    assert.ok(shapeScore(L_SHAPE, scaledAndShifted) >= 90);
  });

  test("a clearly different shape scores low", () => {
    assert.ok(shapeScore(VERTICAL_LINE, HORIZONTAL_LINE) < 40);
  });

  test("an empty attempt scores 0 instead of throwing", () => {
    assert.equal(shapeScore(L_SHAPE, []), 0);
  });

  test("stroke direction doesn't affect shape score -- it's a pure silhouette comparison", () => {
    const reversedFirstStroke = [reversed(L_SHAPE[0]), L_SHAPE[1]];
    assert.ok(shapeScore(L_SHAPE, reversedFirstStroke) >= 95);
  });
});

describe("strokeOrderScore", () => {
  test("identical strokes in the same order score at or near 100", () => {
    const result = strokeOrderScore(L_SHAPE, L_SHAPE);
    assert.ok(result.score >= 95);
    assert.equal(result.strokeCountMatches, true);
  });

  test("a stroke drawn backwards is flagged and penalized, even though the shape is identical", () => {
    const drawnBackwards = [reversed(L_SHAPE[0]), L_SHAPE[1]];
    const result = strokeOrderScore(L_SHAPE, drawnBackwards);
    assert.equal(result.perStrokeDeviations[0].directionReversed, true);
    // same path, opposite direction -- shapeScore treats these as identical (tested
    // above), strokeOrderScore must not
    assert.ok(result.score < strokeOrderScore(L_SHAPE, L_SHAPE).score);
  });

  test("wrong stroke count is penalized and reported", () => {
    const oneStrokeOnly = [L_SHAPE[0]];
    const result = strokeOrderScore(L_SHAPE, oneStrokeOnly);
    assert.equal(result.strokeCountMatches, false);
    assert.equal(result.attemptStrokeCount, 1);
    assert.equal(result.referenceStrokeCount, 2);
  });

  test("both empty is a vacuous perfect match; one empty is a zero", () => {
    assert.equal(strokeOrderScore([], []).score, 100);
    assert.equal(strokeOrderScore([], L_SHAPE).score, 0);
    assert.equal(strokeOrderScore(L_SHAPE, []).score, 0);
  });
});

describe("scoreAttempt", () => {
  test("combines shape and stroke-order scores and carries through the character identity", () => {
    const referenceData = { character: "ሀ", romanization: "ha", strokes: L_SHAPE };
    const result = scoreAttempt(referenceData, L_SHAPE);
    assert.equal(result.character, "ሀ");
    assert.equal(result.romanization, "ha");
    assert.ok(result.shapeScore >= 95);
    assert.ok(result.strokeOrderScore >= 95);
  });
});

// regression guard for the single-reference pass/fail path (see
// scripts/validate-single-reference-scoring.js, which measured these baselines against
// the current production data: ~93.5 average, ~2.5% of samples below the pass threshold).
// thresholds below have headroom above that baseline, but would have caught the real
// stroke-order-averaging bug that once dropped "pu"'s own-sample average from ~90 to ~29
describe("shapeScore against real reference data", () => {
  test("every character's consensus reference stays representative of its own recorded samples", () => {
    const PER_CHARACTER_FLOOR = 60;
    const OVERALL_FLOOR = 85;

    let overallTotal = 0;
    let overallCount = 0;
    const weakCharacters = [];

    for (const romanization of listAvailableCharacters()) {
      const consensus = loadReference(romanization);
      const charDir = join(MULTI_DIR, romanization);
      const sampleFiles = readdirSync(charDir).filter((f) => f.startsWith("sample_") && f.endsWith(".json"));

      const scores = sampleFiles.map((file) => {
        const sample = JSON.parse(readFileSync(join(charDir, file), "utf-8"));
        return shapeScore(consensus.strokes, sample.strokes);
      });

      const charAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      overallTotal += scores.reduce((a, b) => a + b, 0);
      overallCount += scores.length;
      if (charAvg < PER_CHARACTER_FLOOR) weakCharacters.push(`${romanization}: ${charAvg.toFixed(1)}`);
    }

    assert.deepEqual(weakCharacters, [], `character(s) whose own samples don't resemble their reference`);
    assert.ok(overallTotal / overallCount >= OVERALL_FLOOR);
  });
});

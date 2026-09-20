import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generatePassFailResult } from "../src/feedback.js";
import { loadReference } from "../src/referenceLoader.js";

// same small stroke-building helpers as scoring.test.js -- kept local rather than shared
// since each file's needs are simple enough that a shared test-helper module isn't worth it
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

const L_SHAPE = [line(0, 0, 0, 100), line(0, 100, 100, 100)];

// no reference_data_multi/ directory for this romanization, so generatePassFailResult
// falls back to the single-reference score -- exercises that code path deliberately
const FAKE_REFERENCE = { character: "X", romanization: "zzz_test_fake_char", strokes: L_SHAPE };

describe("generatePassFailResult -- single-reference fallback (no multi-sample data)", () => {
  test("an exact match passes with a strong-match message", () => {
    const result = generatePassFailResult(FAKE_REFERENCE, L_SHAPE);
    assert.equal(result.passed, true);
    assert.equal(result._internalPerSampleScores, null);
    assert.ok(result.messages.some((m) => /strong match/i.test(m)));
  });

  test("fewer strokes than the reference is reported as missing strokes", () => {
    const oneStroke = [L_SHAPE[0]];
    const result = generatePassFailResult(FAKE_REFERENCE, oneStroke);
    assert.ok(result.messages.some((m) => /needs 2 strokes.*1 drawn/i.test(m)));
    assert.ok(result.messages.some((m) => /1 stroke missing/i.test(m)));
  });

  test("more strokes than the reference is reported as extra strokes", () => {
    const extraStroke = [...L_SHAPE, line(50, 50, 60, 60)];
    const result = generatePassFailResult(FAKE_REFERENCE, extraStroke);
    assert.ok(result.messages.some((m) => /only needs 2 strokes/i.test(m)));
    assert.ok(result.messages.some((m) => /1 extra stroke drawn/i.test(m)));
  });

  test("a backwards stroke is called out by index, same stroke count", () => {
    const backwardsFirstStroke = [reversed(L_SHAPE[0]), L_SHAPE[1]];
    const result = generatePassFailResult(FAKE_REFERENCE, backwardsFirstStroke);
    assert.ok(result.messages.some((m) => /stroke 1.*wrong direction/i.test(m)));
  });

  test("an empty attempt fails outright", () => {
    const result = generatePassFailResult(FAKE_REFERENCE, []);
    assert.equal(result.passed, false);
    assert.equal(result.message, "Try again.");
  });
});

describe("generatePassFailResult -- real character with recorded multi-sample data", () => {
  test("tracing the actual reference exactly passes using the best-3-of-5 multi-sample score", () => {
    const reference = loadReference("ha");
    const result = generatePassFailResult(reference, reference.strokes);
    assert.equal(result.passed, true);
    assert.equal(result._internalPerSampleScores.length, 5);
  });
});

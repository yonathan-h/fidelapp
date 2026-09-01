import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dtw } from "../src/dtw.js";

describe("dtw", () => {
  test("identical sequences have zero distance", () => {
    const series = [
      [0, 0],
      [1, 1],
      [2, 2],
    ];
    assert.equal(dtw(series, series), 0);
  });

  test("tolerates different sampling density along the same path much better than an actually different path of the same scale", () => {
    // DTW's accumulated cost isn't zero just because two sequences trace the same line at
    // different densities -- the cost recurrence sums a local distance at every step of the
    // warping path, so re-sampling the same straight line still costs something (worked out
    // by hand: 12 for the pair below). What DTW is actually for is staying *much* cheaper
    // than a genuinely different path of comparable scale, which this test checks instead.
    const sparse = [
      [0, 0],
      [10, 0],
    ];
    const denseSameLine = [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [10, 0],
    ];
    const denseDifferentPath = [
      [0, 0],
      [2, 5],
      [4, -5],
      [6, 5],
      [8, -5],
      [10, 0],
    ];
    assert.ok(dtw(sparse, denseSameLine) < dtw(sparse, denseDifferentPath));
  });

  test("clearly different paths produce a large distance", () => {
    const horizontal = [
      [0, 0],
      [10, 0],
    ];
    const vertical = [
      [0, 0],
      [0, 10],
    ];
    assert.ok(dtw(horizontal, vertical) > 5);
  });

  test("either sequence being empty returns 0 rather than throwing", () => {
    assert.equal(dtw([], [[0, 0]]), 0);
    assert.equal(dtw([[0, 0]], []), 0);
    assert.equal(dtw([], []), 0);
  });
});

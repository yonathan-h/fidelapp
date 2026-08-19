// compares a drawn attempt against recorded reference strokes
// two scores: shapeScore (silhouette overlap) and strokeOrderScore (path + direction per stroke via dtw)
// strokes format: array of strokes, each stroke an array of {x, y, t} points

import { dtw } from "./dtw.js";

function strokesToPoints(strokes) {
  const points = [];
  for (const stroke of strokes) {
    for (const p of stroke) points.push([p.x, p.y]);
  }
  return points;
}

function pointsMin(points) {
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))];
}

function pointsMax(points) {
  return [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}

// shared by normalizePoints and centerAndScaleToOwnBBox -- both need the point cloud's
// own bounding box, just apply the scale differently
function boundingBox(points) {
  const minXY = pointsMin(points);
  const maxXY = pointsMax(points);
  const longerDim = Math.max(maxXY[0] - minXY[0], maxXY[1] - minXY[1]);
  return { minXY, maxXY, longerDim };
}

// used by strokeOrderScore -- normalizes each stroke independently (own bounding box),
// fine there since we only care about shape/direction per stroke, not absolute position
function normalizePoints(points, targetSize = 100.0) {
  if (points.length === 0) return points;

  const { minXY, longerDim } = boundingBox(points);
  const shifted = points.map((p) => [p[0] - minXY[0], p[1] - minXY[1]]);

  if (longerDim === 0) return shifted; // single point or all points identical

  const scale = targetSize / longerDim;
  return shifted.map((p) => [p[0] * scale, p[1] * scale]);
}

function normalizeStroke(strokePoints, targetSize = 100.0, refMin = null, refScale = null) {
  const points = strokePoints.map((p) => [p.x, p.y]);
  if (refMin !== null && refScale !== null) {
    return points.map((p) => [(p[0] - refMin[0]) * refScale, (p[1] - refMin[1]) * refScale]);
  }
  return normalizePoints(points, targetSize);
}

// used by shapeScore -- centers + uniformly scales each shape to its own bounding box
// (single scale factor, no independent x/y stretch, so aspect ratio isn't distorted).
// scaling by own bbox rather than by canvas size is what makes this a shape comparison:
// a canvas-size-ratio scale silently assumes the reference and attempt fill the same
// proportion of their respective canvases, which real handwriting doesn't reliably do
function centerAndScaleToOwnBBox(points, targetSize) {
  if (points.length === 0) return points;

  const { minXY, maxXY, longerDim } = boundingBox(points);
  const centerX = (minXY[0] + maxXY[0]) / 2;
  const centerY = (minXY[1] + maxXY[1]) / 2;

  if (longerDim === 0) return points.map(() => [targetSize / 2, targetSize / 2]);

  const scale = targetSize / longerDim;
  return points.map((p) => [
    (p[0] - centerX) * scale + targetSize / 2,
    (p[1] - centerY) * scale + targetSize / 2,
  ]);
}

// shared by shapeScore and shapeRegionDeviations -- both need ref + attempt rasterized
// onto the same grid before comparing, no reason to duplicate this twice
function rasterizeForComparison(referenceStrokes, attemptStrokes, gridSize) {
  const targetSize = 100;
  const refPoints = centerAndScaleToOwnBBox(strokesToPoints(referenceStrokes), targetSize);
  const attemptPoints = centerAndScaleToOwnBBox(strokesToPoints(attemptStrokes), targetSize);

  if (refPoints.length === 0 || attemptPoints.length === 0) return null;

  return {
    refGrid: renderToGrid(refPoints, gridSize),
    attemptGrid: renderToGrid(attemptPoints, gridSize),
  };
}

// rasterizes a point cloud onto a binary grid, drawing connecting lines between
// consecutive points so fast/sparse strokes don't leave gaps
function renderToGrid(points, gridSize = 64, lineWidth = 2) {
  const grid = Array.from({ length: gridSize }, () => new Uint8Array(gridSize));
  if (points.length === 0) return grid;

  const scaled = points.map((p) => [
    Math.min(Math.max((p[0] / 100.0) * (gridSize - 1), 0), gridSize - 1),
    Math.min(Math.max((p[1] / 100.0) * (gridSize - 1), 0), gridSize - 1),
  ]);

  function mark(x, y) {
    for (let dx = -lineWidth; dx <= lineWidth; dx++) {
      for (let dy = -lineWidth; dy <= lineWidth; dy++) {
        const xi = Math.round(x + dx);
        const yi = Math.round(y + dy);
        if (xi >= 0 && xi < gridSize && yi >= 0 && yi < gridSize) grid[yi][xi] = 1;
      }
    }
  }

  for (let i = 0; i < scaled.length; i++) {
    mark(scaled[i][0], scaled[i][1]);
    if (i > 0) {
      const [x0, y0] = scaled[i - 1];
      const [x1, y1] = scaled[i];
      const dist = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      const steps = Math.floor(dist) + 1;
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        mark(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      }
    }
  }

  return grid;
}

// silhouette overlap (iou), 0-100. multiplier (125) calibrated for own-bbox normalization
// against all 147 characters' recorded samples -- every recorded sample scores >=70
// against its own character's other samples, while wrong-character comparisons still
// mostly land well below the threshold
export function shapeScore(referenceStrokes, attemptStrokes, gridSize = 64) {
  const grids = rasterizeForComparison(referenceStrokes, attemptStrokes, gridSize);
  if (!grids) return 0.0;

  let intersection = 0;
  let union = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const r = grids.refGrid[y][x];
      const a = grids.attemptGrid[y][x];
      if (r && a) intersection++;
      if (r || a) union++;
    }
  }

  if (union === 0) return 0.0;

  const iou = intersection / union;
  return Math.min(100.0, iou * 125);
}

const REGION_LABELS = {
  "0,0": "top-left",
  "0,1": "top-right",
  "1,0": "bottom-left",
  "1,1": "bottom-right",
};

// flags which quadrant has the biggest mismatch, for feedback like "bottom-left doesn't match"
// less reliable when stroke count is wrong (bounding box shifts when a whole stroke is missing) --
// prefer strokeOrderScore's count check for that case
export function shapeRegionDeviations(referenceStrokes, attemptStrokes, gridSize = 64, minRegionPixels = 8) {
  const grids = rasterizeForComparison(referenceStrokes, attemptStrokes, gridSize);
  if (!grids) return [];

  const { refGrid, attemptGrid } = grids;
  const half = Math.floor(gridSize / 2);
  const deviations = [];

  for (const row of [0, 1]) {
    for (const col of [0, 1]) {
      let refInk = 0;
      let missing = 0;
      let extra = 0;
      let attemptInkInRegion = 0;

      for (let y = row * half; y < (row + 1) * half; y++) {
        for (let x = col * half; x < (col + 1) * half; x++) {
          const r = refGrid[y][x];
          const a = attemptGrid[y][x];
          if (r) refInk++;
          if (a) attemptInkInRegion++;
          if (r && !a) missing++;
          if (a && !r) extra++;
        }
      }

      if (refInk < minRegionPixels) continue;

      const missingRatio = missing / refInk;
      const extraRatio = extra / Math.max(attemptInkInRegion, 1);

      if (missingRatio > 0.4) {
        deviations.push({ region: REGION_LABELS[`${row},${col}`], issue: "missing", severity: missingRatio });
      } else if (extraRatio > 0.4) {
        deviations.push({ region: REGION_LABELS[`${row},${col}`], issue: "extra", severity: extraRatio });
      }
    }
  }

  deviations.sort((a, b) => b.severity - a.severity);
  return deviations;
}

// compares stroke-by-stroke path + direction via dtw. strict: wrong stroke count,
// reordering, or reversed direction all tank the score
export function strokeOrderScore(referenceStrokes, attemptStrokes) {
  const refCount = referenceStrokes.length;
  const attemptCount = attemptStrokes.length;

  const result = {
    score: 0.0,
    referenceStrokeCount: refCount,
    attemptStrokeCount: attemptCount,
    strokeCountMatches: refCount === attemptCount,
    perStrokeDeviations: [],
  };

  if (refCount === 0) {
    result.score = attemptCount === 0 ? 100.0 : 0.0;
    return result;
  }
  if (attemptCount === 0) {
    result.score = 0.0;
    return result;
  }
  // stroke count alone isn't enough -- a stroke can exist with zero usable points
  if (strokesToPoints(attemptStrokes).length === 0) {
    result.score = 0.0;
    return result;
  }

  // normalize ref and attempt independently, but every stroke within each uses the same
  // min/scale (from the full multi-stroke point cloud) so strokes stay positioned relative
  // to each other rather than each being centered on its own
  const { minXY: refMin, longerDim: refLongerDim } = boundingBox(strokesToPoints(referenceStrokes));
  const refScale = 100.0 / (refLongerDim || 1.0);

  const { minXY: attemptMin, longerDim: attemptLongerDim } = boundingBox(strokesToPoints(attemptStrokes));
  const attemptScale = 100.0 / (attemptLongerDim || 1.0);

  const normRefStrokes = referenceStrokes.map((s) => normalizeStroke(s, 100.0, refMin, refScale));
  const normAttemptStrokes = attemptStrokes.map((s) => normalizeStroke(s, 100.0, attemptMin, attemptScale));

  // compared pairwise in order (stroke i vs stroke i) -- not an alignment problem
  const compareCount = Math.min(refCount, attemptCount);
  const strokeDtwScores = [];

  for (let i = 0; i < compareCount; i++) {
    const refStroke = normRefStrokes[i];
    const attStroke = normAttemptStrokes[i];

    const distance = dtw(refStroke, attStroke);
    const avgPathLen = (refStroke.length + attStroke.length) / 2;
    const normalizedDistance = distance / Math.max(avgPathLen, 1);

    // start->end vector comparison -- cosine near -1 means drawn backwards
    const refVec = [refStroke[refStroke.length - 1][0] - refStroke[0][0], refStroke[refStroke.length - 1][1] - refStroke[0][1]];
    const attVec = [attStroke[attStroke.length - 1][0] - attStroke[0][0], attStroke[attStroke.length - 1][1] - attStroke[0][1]];
    const refNorm = Math.sqrt(refVec[0] ** 2 + refVec[1] ** 2);
    const attNorm = Math.sqrt(attVec[0] ** 2 + attVec[1] ** 2);

    let directionReversed = false;
    if (refNorm > 1e-6 && attNorm > 1e-6) {
      const cosSim = (refVec[0] * attVec[0] + refVec[1] * attVec[1]) / (refNorm * attNorm);
      directionReversed = cosSim < -0.3;
    }

    // exponential decay, k=12 -- identical -> 100, small noise -> ~85-90, wrong char -> ~1
    let strokeScore = 100.0 * Math.exp(-normalizedDistance / 12.0);
    if (directionReversed) strokeScore *= 0.3;

    strokeDtwScores.push(strokeScore);
    result.perStrokeDeviations.push({
      strokeIndex: i,
      score: Math.round(strokeScore * 10) / 10,
      directionReversed,
    });
  }

  const countPenalty = 1.0 - Math.abs(refCount - attemptCount) / Math.max(refCount, attemptCount);
  const baseScore = strokeDtwScores.length > 0 ? strokeDtwScores.reduce((a, b) => a + b, 0) / compareCount : 0.0;

  result.score = Math.round(baseScore * countPenalty * 10) / 10;
  return result;
}

// single-reference entry point
export function scoreAttempt(referenceData, attemptStrokes) {
  const referenceStrokes = referenceData.strokes;

  const shape = shapeScore(referenceStrokes, attemptStrokes);
  const strokeOrder = strokeOrderScore(referenceStrokes, attemptStrokes);

  return {
    character: referenceData.character,
    romanization: referenceData.romanization,
    shapeScore: Math.round(shape * 10) / 10,
    strokeOrderScore: strokeOrder.score,
    strokeOrderDetail: strokeOrder,
  };
}

// multi-sample verification: compares the attempt against all 5 recorded samples
// of the character, averages the best 3. best-3-of-5 (not avg of all 5, not just
// the single best) tolerates one weak/outlier reference sample without letting
// either extreme dominate -- the attempt has to genuinely resemble most of the
// known-good examples, not just one
export function scoreAttemptMulti(samples, attemptStrokes) {
  if (!samples || samples.length === 0) {
    return { shapeScore: 0.0, perSampleScores: [] };
  }

  const perSampleScores = samples.map((sample) => shapeScore(sample.strokes, attemptStrokes));

  const sorted = [...perSampleScores].sort((a, b) => b - a);
  const topCount = Math.min(3, sorted.length);
  const top = sorted.slice(0, topCount);
  const avgOfTop = top.reduce((a, b) => a + b, 0) / top.length;

  return {
    shapeScore: Math.round(avgOfTop * 10) / 10,
    perSampleScores: perSampleScores.map((s) => Math.round(s * 10) / 10),
  };
}

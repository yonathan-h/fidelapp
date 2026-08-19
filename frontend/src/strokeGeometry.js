// smoothing + playback-timing helpers for rendering a recorded reference stroke as a
// clean guide, instead of the raw jittery point cloud captured by pointer sampling

// drops points closer than minDist to the last kept point -- raw recordings sample every
// few ms, producing far more points than a smooth curve needs and amplifying small hand
// tremor into visible jaggedness when drawn as a straight-segment polyline
function simplifyByDistance(points, minDist) {
  if (points.length <= 2) return points;
  const kept = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = kept[kept.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDist || i === points.length - 1) {
      kept.push(points[i]);
    }
  }
  return kept;
}

// Catmull-Rom spline through `points`, expressed as a cubic-bezier SVG path -- passes
// through every point (unlike a least-squares fit) but with smooth curvature between them
function catmullRomPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function smoothStrokePath(points, minDist = 4) {
  return catmullRomPath(simplifyByDistance(points, minDist));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const DEMO_INITIAL_DELAY_MS = 300;
const DEMO_MIN_STROKE_MS = 350;
const DEMO_MAX_STROKE_MS = 1400;
const DEMO_MIN_GAP_MS = 120;
const DEMO_MAX_GAP_MS = 500;
export const DEMO_HOLD_MS = 500; // how long the finished character stays visible before fading
export const DEMO_FADE_MS = 350;

// when the demo's colored stroke should start fading back out to just the grey ghost --
// a beat after the last stroke finishes drawing, so the finished character is visible
// briefly before handing off to the plain guide the user actually traces over
export function demoFadeOutDelay(timing) {
  if (timing.length === 0) return 0;
  return Math.max(...timing.map((t) => t.delay + t.duration)) + DEMO_HOLD_MS;
}

// derives a per-stroke {delay, duration} playback schedule (ms, relative to demo start)
// from each point's recorded relative timestamp -- clamped so an unusually fast/slow or
// pausey recording still plays back at a legible, consistent pace
export function computeStrokeTiming(strokesWithT) {
  let cursor = DEMO_INITIAL_DELAY_MS;
  return strokesWithT.map((stroke, i) => {
    if (stroke.length === 0) return { delay: cursor, duration: DEMO_MIN_STROKE_MS };
    const strokeStartT = stroke[0].t ?? 0;
    const strokeEndT = stroke[stroke.length - 1].t ?? 0;
    if (i > 0) {
      const prevStroke = strokesWithT[i - 1];
      const prevEndT = prevStroke[prevStroke.length - 1]?.t ?? strokeStartT;
      cursor += clamp(strokeStartT - prevEndT, DEMO_MIN_GAP_MS, DEMO_MAX_GAP_MS);
    }
    const duration = clamp(strokeEndT - strokeStartT, DEMO_MIN_STROKE_MS, DEMO_MAX_STROKE_MS);
    const delay = cursor;
    cursor += duration;
    return { delay, duration };
  });
}

// groups a multi-letter canvas's drawn strokes by which letter slot they belong to, using
// each stroke's own horizontal center vs. each slot's center -- a single pointer-down-to-up
// stroke essentially never spans two letters since users naturally lift the pen between
// them, so nearest-slot-center is a robust (and much simpler than boundary-based) rule
export function assignStrokesToSlots(strokes, slotLayout) {
  const bySlot = slotLayout.map(() => []);
  if (slotLayout.length === 0) return bySlot;

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    const avgX = stroke.reduce((sum, p) => sum + p.x, 0) / stroke.length;

    let bestIndex = 0;
    let bestDist = Infinity;
    slotLayout.forEach((slot, i) => {
      const dist = Math.abs(avgX - (slot.x + slot.width / 2));
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });
    bySlot[bestIndex].push(stroke);
  }
  return bySlot;
}

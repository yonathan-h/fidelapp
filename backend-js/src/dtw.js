// exact dtw, not fastdtw's approximation -- no maintained fastdtw equivalent on npm,
// and stroke sequences here are short enough that O(n*m) is plenty fast

function euclideanDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// returns the min-cost alignment distance between two point sequences
export function dtw(seriesA, seriesB) {
  const n = seriesA.length;
  const m = seriesB.length;

  if (n === 0 || m === 0) return 0;

  const cost = Array.from({ length: n }, () => new Array(m).fill(Infinity));

  cost[0][0] = euclideanDistance(seriesA[0], seriesB[0]);
  for (let i = 1; i < n; i++) cost[i][0] = cost[i - 1][0] + euclideanDistance(seriesA[i], seriesB[0]);
  for (let j = 1; j < m; j++) cost[0][j] = cost[0][j - 1] + euclideanDistance(seriesA[0], seriesB[j]);

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const d = euclideanDistance(seriesA[i], seriesB[j]);
      cost[i][j] = d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }

  return cost[n - 1][m - 1];
}

// like dtw(), but also returns the alignment path (index pairs from (0,0) to (n-1,m-1))
// instead of just the cost -- used offline to build point-for-point correspondences
// between two hand-drawn strokes of different length/pacing, e.g. for averaging several
// recorded samples of the same character into one consensus shape. kept separate from
// dtw() rather than having that function optionally return more, since dtw() is on the
// live scoring path and shouldn't carry the extra backtrace bookkeeping
export function dtwAlignmentPath(seriesA, seriesB) {
  const n = seriesA.length;
  const m = seriesB.length;
  if (n === 0 || m === 0) return { path: [], distance: 0 };

  const cost = Array.from({ length: n }, () => new Array(m).fill(Infinity));
  const back = Array.from({ length: n }, () => new Array(m).fill(null));

  cost[0][0] = euclideanDistance(seriesA[0], seriesB[0]);
  for (let i = 1; i < n; i++) {
    cost[i][0] = cost[i - 1][0] + euclideanDistance(seriesA[i], seriesB[0]);
    back[i][0] = [i - 1, 0];
  }
  for (let j = 1; j < m; j++) {
    cost[0][j] = cost[0][j - 1] + euclideanDistance(seriesA[0], seriesB[j]);
    back[0][j] = [0, j - 1];
  }

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const d = euclideanDistance(seriesA[i], seriesB[j]);
      const candidates = [
        { cost: cost[i - 1][j], from: [i - 1, j] },
        { cost: cost[i][j - 1], from: [i, j - 1] },
        { cost: cost[i - 1][j - 1], from: [i - 1, j - 1] },
      ];
      const best = candidates.reduce((a, b) => (b.cost < a.cost ? b : a));
      cost[i][j] = d + best.cost;
      back[i][j] = best.from;
    }
  }

  const path = [[n - 1, m - 1]];
  let cur = [n - 1, m - 1];
  while (back[cur[0]][cur[1]]) {
    cur = back[cur[0]][cur[1]];
    path.push(cur);
  }
  path.reverse();

  return { path, distance: cost[n - 1][m - 1] };
}

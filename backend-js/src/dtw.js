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

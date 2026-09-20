// turns scoring.js's raw numbers into human-readable messages, and decides pass/fail

import { scoreAttempt, shapeRegionDeviations } from "./scoring.js";

const PASS_THRESHOLD = 70; // shape score cutoff for the demo's pass/fail

function strokeWord(n) {
  return n === 1 ? "stroke" : "strokes";
}

// itemized stroke/count/direction/region detail and the pass/fail decision both come from
// the same single-reference comparison (scoreAttempt), so they can't contradict each other
// by construction -- no separate score to keep in sync
function buildMessages(referenceData, attemptStrokes, singleRefResult, passed) {
  const strokeDetail = singleRefResult.strokeOrderDetail;
  const referenceStrokes = referenceData.strokes;

  const messages = [];
  const refCount = strokeDetail.referenceStrokeCount;
  const attemptCount = strokeDetail.attemptStrokeCount;

  // stroke count mismatch first -- takes priority since region detection
  // gets unreliable once counts don't match
  if (attemptCount < refCount) {
    const diff = refCount - attemptCount;
    messages.push(`Needs ${refCount} ${strokeWord(refCount)}, only ${attemptCount} drawn. ${diff} ${strokeWord(diff)} missing.`);
  } else if (attemptCount > refCount) {
    const diff = attemptCount - refCount;
    messages.push(`Only needs ${refCount} ${strokeWord(refCount)}. ${diff} extra ${strokeWord(diff)} drawn.`);
  }

  // worth flagging even alongside a count mismatch if the shape is really off
  if (attemptCount !== refCount && singleRefResult.shapeScore < 35) {
    messages.push("Overall shape doesn't closely resemble this character. Double check which character you're drawing.");
  }

  if (attemptCount === refCount) {
    const reversedStrokes = strokeDetail.perStrokeDeviations
      .filter((d) => d.directionReversed)
      .map((d) => d.strokeIndex + 1);

    if (reversedStrokes.length === 1) {
      messages.push(`Stroke ${reversedStrokes[0]} looks drawn in the wrong direction. Check its start and end points.`);
    } else if (reversedStrokes.length > 1) {
      messages.push(`Strokes ${reversedStrokes.join(", ")} look drawn in the wrong direction. Check their start and end points.`);
    }

    const weakStrokes = strokeDetail.perStrokeDeviations
      .filter((d) => !d.directionReversed && d.score < 60)
      .map((d) => d.strokeIndex + 1);

    if (weakStrokes.length === 1) {
      messages.push(`Stroke ${weakStrokes[0]} doesn't closely match the reference. Try slowing down on it.`);
    } else if (weakStrokes.length > 1) {
      messages.push(`Strokes ${weakStrokes.join(", ")} don't closely match the reference. Try slowing down on them.`);
    }
  }

  if (attemptCount === refCount) {
    const regionDeviations = shapeRegionDeviations(referenceStrokes, attemptStrokes);
    if (regionDeviations.length > 0) {
      const worst = regionDeviations[0];
      messages.push(
        worst.issue === "missing"
          ? `Not enough ink in the ${worst.region}. Looks incomplete or shifted there.`
          : `Extra ink in the ${worst.region} that isn't part of the reference.`
      );
    }
  }

  if (messages.length === 0) {
    if (passed && singleRefResult.strokeOrderScore >= 90 && singleRefResult.shapeScore >= 90) {
      messages.push("Strong match on both shape and stroke order.");
    } else if (passed) {
      // shape is the priority signal for passing, so a pass earns this even
      // if stroke order is mediocre
      messages.push("Good attempt. Minor variation from the reference, nothing specific stands out.");
    } else {
      messages.push("Match is a bit loose. Try tracing more closely over the guide.");
    }
  }

  return messages;
}

export function generatePassFailResult(referenceData, attemptStrokes) {
  const singleRefResult = scoreAttempt(referenceData, attemptStrokes);
  const passed = singleRefResult.shapeScore >= PASS_THRESHOLD;
  const messages = buildMessages(referenceData, attemptStrokes, singleRefResult, passed);

  return {
    passed,
    message: passed ? "Well done!" : "Try again.",
    messages,
    // these never go to the client, just persisted for progress/history
    _internalShapeScore: singleRefResult.shapeScore,
    _internalStrokeOrderScore: singleRefResult.strokeOrderScore,
  };
}

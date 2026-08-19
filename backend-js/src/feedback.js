// turns scoring.js's raw numbers into human-readable messages, and decides pass/fail

import { scoreAttempt, scoreAttemptMulti, shapeRegionDeviations } from "./scoring.js";
import { loadReferenceMulti } from "./referenceLoader.js";

const PASS_THRESHOLD = 70; // shape score cutoff for the demo's pass/fail

function strokeWord(n) {
  return n === 1 ? "stroke" : "strokes";
}

// itemized stroke/count/direction/region detail comes from comparing against the single
// recorded reference (need one concrete stroke sequence to diff against), but the final
// summary line uses the authoritative multi-sample passed/shapeScore so it never contradicts
// the pass/fail banner shown alongside it
function buildMessages(referenceData, attemptStrokes, singleRefResult, passed, authoritativeShapeScore) {
  const strokeDetail = singleRefResult.strokeOrderDetail;
  const referenceStrokes = referenceData.strokes;

  const messages = [];
  const refCount = strokeDetail.referenceStrokeCount;
  const attemptCount = strokeDetail.attemptStrokeCount;

  // stroke count mismatch first -- takes priority since region detection
  // gets unreliable once counts don't match
  if (attemptCount < refCount) {
    const diff = refCount - attemptCount;
    const isAre = diff === 1 ? "is" : "are";
    const wasWere = attemptCount === 1 ? "was" : "were";
    messages.push(
      `This character needs ${refCount} ${strokeWord(refCount)}, but only ` +
        `${attemptCount} ${wasWere} drawn — ${diff} ${strokeWord(diff)} ${isAre} missing.`
    );
  } else if (attemptCount > refCount) {
    const diff = attemptCount - refCount;
    messages.push(
      `This character only needs ${refCount} ${strokeWord(refCount)}, but ` +
        `${attemptCount} were drawn — ${diff} extra ${strokeWord(diff)}.`
    );
  }

  // worth flagging even alongside a count mismatch if the shape is really off
  if (attemptCount !== refCount && singleRefResult.shapeScore < 35) {
    messages.push(
      "On top of the stroke count, the overall shape doesn't closely " +
        "resemble this character — double check which character you're drawing."
    );
  }

  if (attemptCount === refCount) {
    const reversedStrokes = strokeDetail.perStrokeDeviations
      .filter((d) => d.directionReversed)
      .map((d) => d.strokeIndex + 1);

    if (reversedStrokes.length === 1) {
      messages.push(
        `Stroke ${reversedStrokes[0]} looks like it was drawn in the wrong ` +
          `direction — check the start and end points.`
      );
    } else if (reversedStrokes.length > 1) {
      messages.push(
        `Strokes ${reversedStrokes.join(", ")} look like they were drawn ` +
          `in the wrong direction — check the start and end points.`
      );
    }

    const weakStrokes = strokeDetail.perStrokeDeviations
      .filter((d) => !d.directionReversed && d.score < 60)
      .map((d) => d.strokeIndex + 1);

    if (weakStrokes.length === 1) {
      messages.push(
        `Stroke ${weakStrokes[0]} doesn't closely match the reference path ` +
          `— try slowing down on that stroke.`
      );
    } else if (weakStrokes.length > 1) {
      messages.push(
        `Strokes ${weakStrokes.join(", ")} don't closely match the ` +
          `reference path — try slowing down on those strokes.`
      );
    }
  }

  if (attemptCount === refCount) {
    const regionDeviations = shapeRegionDeviations(referenceStrokes, attemptStrokes);
    if (regionDeviations.length > 0) {
      const worst = regionDeviations[0];
      messages.push(
        worst.issue === "missing"
          ? `The ${worst.region} area doesn't have enough ink — that part of the character looks incomplete or shifted.`
          : `The ${worst.region} area has extra strokes that aren't part of the reference shape.`
      );
    }
  }

  if (messages.length === 0) {
    if (passed && singleRefResult.strokeOrderScore >= 90 && authoritativeShapeScore >= 90) {
      messages.push("Strong match on both shape and stroke order.");
    } else if (passed) {
      // shape is the priority signal for passing, so a pass earns this even
      // if stroke order is mediocre
      messages.push("Good attempt overall — minor variation from the reference, nothing specific stands out as wrong.");
    } else {
      messages.push("The overall match is a bit loose — try tracing more closely over the reference guide.");
    }
  }

  return messages;
}

export function generatePassFailResult(referenceData, attemptStrokes) {
  const singleRefResult = scoreAttempt(referenceData, attemptStrokes);

  // multi-sample (best-3-of-5) is the real pass/fail signal when available,
  // falls back to the single-sample score otherwise
  const multiSamples = loadReferenceMulti(referenceData.romanization);
  let shapeScoreForPassing = singleRefResult.shapeScore;
  let perSampleScores = null;

  if (multiSamples && multiSamples.length > 0) {
    const multiResult = scoreAttemptMulti(multiSamples, attemptStrokes);
    shapeScoreForPassing = multiResult.shapeScore;
    perSampleScores = multiResult.perSampleScores;
  }

  const passed = shapeScoreForPassing >= PASS_THRESHOLD;
  const messages = buildMessages(referenceData, attemptStrokes, singleRefResult, passed, shapeScoreForPassing);

  return {
    passed,
    message: passed ? "Well done!" : "Try again.",
    messages,
    // these never go to the client, just persisted for progress/history
    _internalShapeScore: shapeScoreForPassing,
    _internalStrokeOrderScore: singleRefResult.strokeOrderScore,
    _internalPerSampleScores: perSampleScores,
  };
}

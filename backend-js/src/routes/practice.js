import express from "express";
import { fn, col } from "sequelize";
import { requireAuth } from "../middleware/requireAuth.js";
import { Attempt } from "../models/Attempt.js";
import { loadReference, listAvailableCharactersWithGlyphs, loadGuideStrokes } from "../referenceLoader.js";
import { generatePassFailResult } from "../feedback.js";
import { WORDS } from "../words.js";

export const practiceRouter = express.Router();

practiceRouter.get("/characters", (req, res) => {
  const characters = listAvailableCharactersWithGlyphs().map((c) => ({
    ...c,
    guideStrokes: loadGuideStrokes(c.romanization) ?? [],
  }));
  res.json(characters);
});

// word/phrase practice is just the existing per-character flow chained across a word's
// letters -- no separate scoring path, so this route only needs to serve the word list
practiceRouter.get("/words", (req, res) => {
  res.json(WORDS);
});

practiceRouter.post("/attempt", requireAuth, async (req, res) => {
  const { romanization, strokes } = req.body;

  if (typeof romanization !== "string" || !Array.isArray(strokes)) {
    return res.status(422).json({
      detail: [{ msg: "Request body must include 'romanization' (string) and 'strokes' (array)." }],
    });
  }

  const referenceData = loadReference(romanization);
  if (!referenceData) {
    return res.status(404).json({ detail: `No character found for '${romanization}'.` });
  }

  try {
    const result = generatePassFailResult(referenceData, strokes);

    // scores still get saved for progress/history, just not echoed back here
    await Attempt.create({
      userId: req.user.id,
      characterRomanization: romanization,
      shapeScore: result._internalShapeScore,
      strokeOrderScore: result._internalStrokeOrderScore,
    });

    res.json({
      character: referenceData.character,
      romanization: referenceData.romanization,
      passed: result.passed,
      message: result.message,
      messages: result.messages,
    });
  } catch (err) {
    console.error("error scoring attempt:", err);
    res.status(500).json({ detail: "Failed to score attempt." });
  }
});

practiceRouter.get("/progress", requireAuth, async (req, res) => {
  try {
    const rows = await Attempt.findAll({
      attributes: [
        "characterRomanization",
        [fn("MAX", col("shape_score")), "bestShapeScore"],
        [fn("MAX", col("stroke_order_score")), "bestStrokeOrderScore"],
        [fn("COUNT", col("id")), "attemptCount"],
      ],
      where: { userId: req.user.id },
      group: ["characterRomanization"],
    });

    const practiced = rows.map((r) => ({
      romanization: r.characterRomanization,
      best_shape_score: Number(r.get("bestShapeScore")),
      best_stroke_order_score: Number(r.get("bestStrokeOrderScore")),
      attempt_count: Number(r.get("attemptCount")),
    }));

    const totalCharacters = listAvailableCharactersWithGlyphs().length;

    res.json({
      total_characters: totalCharacters,
      practiced_count: practiced.length,
      characters: practiced,
    });
  } catch (err) {
    console.error("error fetching progress:", err);
    res.status(500).json({ detail: "Failed to fetch progress." });
  }
});

practiceRouter.get("/history", requireAuth, async (req, res) => {
  const { romanization, limit = 50 } = req.query;

  const where = { userId: req.user.id };
  if (romanization) {
    where.characterRomanization = romanization;
  }

  try {
    const attempts = await Attempt.findAll({
      where,
      order: [["created_at", "DESC"]], // has to be the db column name, not the js attribute name
      limit: Number(limit),
    });

    res.json(
      attempts.map((a) => ({
        id: a.id,
        character_romanization: a.characterRomanization,
        shape_score: a.shapeScore,
        stroke_order_score: a.strokeOrderScore,
        created_at: a.created_at.toISOString(), // yes, created_at not createdAt -- see model definition
      }))
    );
  } catch (err) {
    console.error("error fetching attempt history:", err);
    res.status(500).json({ detail: "Failed to fetch attempt history." });
  }
});

// standalone, LOCAL-ONLY tool for recording new reference character samples.
// deliberately never imported by server.js -- there is zero code path from the
// deployed app to this file, so this filesystem-writing endpoint can never ship.
//
// run with:  node scripts/recorder-server.js
// then open: http://localhost:8001
import express from "express";
import { readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");
const PORT = 8001;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

function assertSafeId(romanization) {
  if (typeof romanization !== "string" || !/^[a-z0-9']+$/.test(romanization)) {
    throw new Error(`Invalid romanization: ${romanization}`);
  }
}

function sampleCount(romanization) {
  const charDir = join(MULTI_DIR, romanization);
  if (!existsSync(charDir)) return 0;
  return readdirSync(charDir).filter((f) => f.startsWith("sample_") && f.endsWith(".json")).length;
}

app.get("/", (req, res) => res.sendFile(join(__dirname, "recorder-tool.html")));

app.get("/api/sample-count", (req, res) => {
  try {
    assertSafeId(req.query.romanization);
  } catch (err) {
    return res.status(400).json({ detail: err.message });
  }
  res.json({ count: sampleCount(req.query.romanization) });
});

app.post("/api/save-sample", (req, res) => {
  const { romanization, character, strokes } = req.body;
  try {
    assertSafeId(romanization);
  } catch (err) {
    return res.status(400).json({ detail: err.message });
  }
  if (typeof character !== "string" || !character) {
    return res.status(400).json({ detail: "Missing character glyph." });
  }
  if (!Array.isArray(strokes) || strokes.length === 0 || strokes.some((s) => !Array.isArray(s) || s.length < 2)) {
    return res.status(400).json({ detail: "No usable strokes to save." });
  }

  const charDir = join(MULTI_DIR, romanization);
  if (!existsSync(charDir)) mkdirSync(charDir, { recursive: true });

  const sampleNumber = sampleCount(romanization) + 1;
  const data = {
    character,
    romanization,
    sample_number: sampleNumber,
    canvas_size: 400,
    recorded_at: new Date().toISOString(),
    strokes,
  };

  writeFileSync(join(charDir, `sample_${sampleNumber}.json`), JSON.stringify(data, null, 2) + "\n");
  res.json({ saved: true, sampleNumber });
});

app.listen(PORT, () => {
  console.log(`Recorder tool running at http://localhost:${PORT}`);
  console.log(`(local-only dev tool -- writes directly into reference_data_multi/, not part of the deployed app)`);
});

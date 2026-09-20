// generates TTS audio clips (Azure Neural TTS, am-ET-AmehaNeural) for every character
// and word, saved as static mp3 files under src/audio/. run locally whenever characters/
// words change -- not part of server runtime, same one-off-tool pattern as
// regenerate-reference-averages.js. generated files are committed to the repo, same as
// reference_data/ is, so production never needs the Azure key at runtime.
//
// usage:
//   node scripts/generate-audio.js --sample   # a handful of clips, to check voice quality first
//   node scripts/generate-audio.js            # every character + word
//   node scripts/generate-audio.js --force    # regenerate even files that already exist

import dotenv from "dotenv";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { listAvailableCharactersWithGlyphs } from "../src/referenceLoader.js";
import { WORDS } from "../src/words.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(__dirname, "..", "src", "audio");
const VOICE = "am-ET-AmehaNeural";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const REQUEST_DELAY_MS = 700; // stay well under the free tier's rate limit

const speechKey = process.env.AZURE_SPEECH_KEY;
const speechRegion = process.env.AZURE_SPEECH_REGION;
if (!speechKey || !speechRegion) {
  console.error("Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION -- set them in backend-js/.env (see .env.example).");
  process.exit(1);
}

// small, representative subset for a quick listen before burning the full batch
const SAMPLE_CHARACTERS = ["a", "ha", "b"];
const SAMPLE_WORDS = ["selam", "and"];

function assertSafeId(id) {
  if (id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error(`Unsafe identifier: ${id}`);
  }
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function fetchAccessToken() {
  const res = await fetch(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": speechKey, "Content-Length": "0" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Azure access token (${res.status}): ${await res.text()}`);
  }
  return res.text();
}

async function synthesize(text, token) {
  // default synthesis level came back noticeably quiet in an initial listen -- boosted via
  // SSML prosody rather than post-processing the files, so generation stays a single step
  const ssml = `<speak version='1.0' xml:lang='am-ET'><voice xml:lang='am-ET' name='${VOICE}'><prosody volume='+50%'>${escapeXml(text)}</prosody></voice></speak>`;

  const res = await fetch(`https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
      "User-Agent": "fidel-app",
    },
    body: ssml,
  });

  if (!res.ok) {
    throw new Error(`Azure TTS request failed (${res.status}): ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateBatch(items, subdir, force) {
  const dir = join(AUDIO_DIR, subdir);
  mkdirSync(dir, { recursive: true });

  let token = await fetchAccessToken();
  let tokenIssuedAt = Date.now();

  let generated = 0;
  let skipped = 0;

  for (const { id, text } of items) {
    assertSafeId(id);
    const outPath = join(dir, `${id}.mp3`);

    if (!force && existsSync(outPath)) {
      skipped++;
      continue;
    }

    // tokens expire after 10 minutes -- refresh proactively rather than waiting for a 401
    if (Date.now() - tokenIssuedAt > 8 * 60 * 1000) {
      token = await fetchAccessToken();
      tokenIssuedAt = Date.now();
    }

    try {
      const audio = await synthesize(text, token);
      writeFileSync(outPath, audio);
      generated++;
      console.log(`  ${subdir}/${id}.mp3 (${text})`);
    } catch (err) {
      console.error(`  FAILED ${subdir}/${id} (${text}): ${err.message}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { generated, skipped };
}

async function main() {
  const sample = process.argv.includes("--sample");
  const force = process.argv.includes("--force");

  const allCharacters = listAvailableCharactersWithGlyphs().map(({ romanization, character }) => ({
    id: romanization,
    text: character,
  }));
  const allWords = WORDS.map((w) => ({ id: w.romanization, text: w.text }));

  const characters = sample ? allCharacters.filter((c) => SAMPLE_CHARACTERS.includes(c.id)) : allCharacters;
  const words = sample ? allWords.filter((w) => SAMPLE_WORDS.includes(w.id)) : allWords;

  console.log(
    `Generating audio for ${characters.length} character(s) and ${words.length} word(s)${sample ? " (sample)" : ""}...`
  );

  const charResult = await generateBatch(characters, "characters", force);
  const wordResult = await generateBatch(words, "words", force);

  console.log(
    `\nDone. Characters: ${charResult.generated} generated, ${charResult.skipped} skipped. ` +
      `Words: ${wordResult.generated} generated, ${wordResult.skipped} skipped.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

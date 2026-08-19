// one-off: checks that all 5 recorded samples for each character agree on stroke count,
// since the DTW-averaging script assumes index-aligned strokes (stroke k of sample A
// corresponds to stroke k of sample B) rather than solving stroke-to-stroke correspondence
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_DIR = join(__dirname, "..", "src", "reference_data_multi");

const chars = readdirSync(MULTI_DIR).sort();
let mismatches = 0;

for (const char of chars) {
  const charDir = join(MULTI_DIR, char);
  const sampleFiles = readdirSync(charDir)
    .filter((f) => f.startsWith("sample_") && f.endsWith(".json"))
    .sort();
  const counts = sampleFiles.map((f) => JSON.parse(readFileSync(join(charDir, f), "utf-8")).strokes.length);
  const allMatch = counts.every((c) => c === counts[0]);
  if (!allMatch || sampleFiles.length !== 5) {
    mismatches++;
    console.log(`${char}: ${sampleFiles.length} samples, stroke counts = [${counts.join(", ")}]`);
  }
}

console.log(`\n${chars.length} characters checked, ${mismatches} with mismatched stroke counts or != 5 samples.`);

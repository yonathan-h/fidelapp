import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { WORDS } from "../src/words.js";
import { listAvailableCharacters } from "../src/referenceLoader.js";

describe("WORDS", () => {
  test("every chunk romanization exists in the real recorded character set", () => {
    const available = new Set(listAvailableCharacters());
    const missing = [];

    for (const word of WORDS) {
      for (const chunk of word.chunks) {
        for (const romanization of chunk) {
          if (!available.has(romanization)) {
            missing.push(`${word.romanization}: "${romanization}"`);
          }
        }
      }
    }

    assert.deepEqual(missing, [], `word(s) reference a romanization with no recorded character`);
  });

  test("chunks concatenate back to the same length as the word's text (sanity check against typos)", () => {
    // a phrase's chunks (one sub-array per space-separated word) should have as many
    // sub-arrays as the text has words, and each sub-array non-empty
    for (const word of WORDS) {
      const wordCount = word.text.split(" ").length;
      assert.equal(word.chunks.length, wordCount, `${word.romanization}: chunk count doesn't match word count in "${word.text}"`);
      for (const chunk of word.chunks) {
        assert.ok(chunk.length > 0, `${word.romanization}: an empty chunk`);
      }
    }
  });
});

import { useEffect, useState, useCallback, useMemo } from "react";
import { signup, login, getCharacters, getWords, submitAttempt, getProgress, getHistory, getMe } from "./api";
import { useStrokeCanvas } from "./useStrokeCanvas";
import { CHARACTER_FAMILIES } from "./characterFamilies";
import {
  smoothStrokePath,
  computeStrokeTiming,
  demoFadeOutDelay,
  assignStrokesToSlots,
  DEMO_FADE_MS,
} from "./strokeGeometry";

const CANVAS_SIZE = 280;
const PASS_THRESHOLD = 70; // matches backend's feedback.js threshold

// word-mode canvas: one row of fixed-width letter slots instead of cycling through a
// separate single-letter canvas per letter. sized so the longest word/phrase currently in
// words.js (8 letters) still comfortably fits the 760px practice column
const WORD_LETTER_SLOT = 80;
const WORD_LETTER_GAP = 5;
const WORD_CHUNK_GAP = 18; // extra gap at a space boundary between chunks (sub-words)
const WORD_CAPTION_HEIGHT = 16; // headroom above each slot for its romanization label

// --sage-deep and --paper-deep from theme.css, duplicated here as plain rgb so the
// progress grid can compute a real blended background color (not just CSS opacity, which
// would fade the glyph text along with the cell instead of only darkening the background)
const SAGE_DEEP_RGB = [94, 117, 112];
const PAPER_DEEP_RGB = [233, 231, 226];

const CELL_LIGHT_TEXT_THRESHOLD = 60; // score at/above this gets white text, below gets black

// background + text color for one progress-grid cell -- text color is a flat score
// threshold, not a luminance cutoff: below CELL_LIGHT_TEXT_THRESHOLD reads as black,
// at/above it as white, regardless of exactly how dark the tint is at that score
function progressCellStyle(score) {
  if (score == null) {
    return { background: "var(--line)", color: "var(--ink)" };
  }
  const alpha = Math.max(0.15, score / 100);
  const blend = SAGE_DEEP_RGB.map((sage, i) => alpha * sage + (1 - alpha) * PAPER_DEEP_RGB[i]);
  return {
    background: `rgb(${blend.map((v) => Math.round(v)).join(",")})`,
    color: score >= CELL_LIGHT_TEXT_THRESHOLD ? "var(--paper)" : "var(--ink)",
  };
}

// centers + uniformly scales the recorded reference strokes to fit the guide box --
// mirrors scoring.js's own-bbox normalization, so the guide is the same shape being scored
function normalizeGuideStrokes(strokes, canvasSize, fillRatio = 0.85) {
  const points = strokes.flat();
  if (points.length === 0) return [];

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const longerDim = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (canvasSize * fillRatio) / longerDim;
  const canvasCenter = canvasSize / 2;

  return strokes.map((stroke) =>
    stroke.map((p) => ({
      x: (p.x - centerX) * scale + canvasCenter,
      y: (p.y - centerY) * scale + canvasCenter,
      t: p.t,
    }))
  );
}


export default function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState(null);
  const [account, setAccount] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const [characters, setCharacters] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // word/phrase practice -- the whole word is drawn on one multi-slot canvas (see
  // WORD_LETTER_SLOT etc.) and checked as a whole; wordLetterResults/wordLetterMessages
  // are populated per letter from that one check, not by cycling through letters
  const [mode, setMode] = useState("characters"); // "characters" | "words"
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordLetterResults, setWordLetterResults] = useState([]); // parallel to letterSequence: null | true | false
  const [wordLetterMessages, setWordLetterMessages] = useState([]); // parallel to letterSequence: null | string[]

  const [progress, setProgress] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { canvasRef, strokes, getStrokes, clear, undo, handlers } = useStrokeCanvas();

  useEffect(() => {
    if (token) {
      getCharacters().then(setCharacters).catch(console.error);
      getWords().then(setWords).catch(console.error);
      getProgress(token).then(setProgress).catch(console.error);
      getMe(token).then(setAccount).catch(console.error);
    }
  }, [token]);

  const charactersByRomanization = useMemo(
    () => new Map(characters.map((c) => [c.romanization, c])),
    [characters]
  );

  // groups the flat API list into per-family sections (see characterFamilies.js), each
  // member tagged with its position in family order -- that position becomes the index
  // used for navigation everywhere else, replacing the old flat-alphabetical ordering
  const groupedCharacters = useMemo(() => {
    if (characters.length === 0) return [];
    let index = 0;
    return CHARACTER_FAMILIES.map((members) => ({
      label: members[0],
      members: members
        .map((rom) => charactersByRomanization.get(rom))
        .filter(Boolean)
        .map((c) => ({ ...c, index: index++ })),
    })).filter((family) => family.members.length > 0);
  }, [characters, charactersByRomanization]);

  const orderedCharacters = useMemo(
    () => groupedCharacters.flatMap((family) => family.members),
    [groupedCharacters]
  );

  // groups words by category, each tagged with its position in the flat words array
  const groupedWords = useMemo(() => {
    const groups = [];
    const byCategory = new Map();
    words.forEach((w, index) => {
      if (!byCategory.has(w.category)) {
        const group = { category: w.category, items: [] };
        byCategory.set(w.category, group);
        groups.push(group);
      }
      byCategory.get(w.category).items.push({ ...w, index });
    });
    return groups;
  }, [words]);

  const currentWordData = words[currentWordIndex] ?? null;

  // flattens a word's chunks (sub-words, for space-separated phrases) into one ordered
  // list of letters to trace -- chunkIndex is kept so the UI can show a gap at each space
  const letterSequence = useMemo(() => {
    if (!currentWordData) return [];
    const seq = [];
    currentWordData.chunks.forEach((chunk, chunkIndex) => {
      chunk.forEach((romanization) => seq.push({ romanization, chunkIndex }));
    });
    return seq;
  }, [currentWordData]);

  const wordComplete =
    mode === "words" && letterSequence.length > 0 && letterSequence.every((_, i) => wordLetterResults[i] != null);
  const wordPassedCount = wordLetterResults.filter((r) => r === true).length;

  // single source of truth for "what's on the canvas right now", character mode only --
  // word mode has no single "active" letter anymore, see wordSlotLayout etc. below
  const activeCharacterData = mode === "characters" ? orderedCharacters[currentIndex] ?? null : null;
  const currentRomanization = activeCharacterData?.romanization ?? null;
  const currentCharacter = activeCharacterData?.character ?? null;

  // leave ~15% margin around the traced guide so it doesn't touch the canvas edge
  const guideStrokes = useMemo(() => {
    if (!activeCharacterData?.guideStrokes?.length) return [];
    return normalizeGuideStrokes(activeCharacterData.guideStrokes, CANVAS_SIZE - 3);
  }, [activeCharacterData]);

  // smoothed path + playback schedule for the "watch it drawn" demo -- recomputed only
  // when the underlying guide changes, not on every render
  const guidePaths = useMemo(() => guideStrokes.map((stroke) => smoothStrokePath(stroke)), [guideStrokes]);
  const guideTiming = useMemo(() => computeStrokeTiming(guideStrokes), [guideStrokes]);
  const guideFadeDelay = useMemo(() => demoFadeOutDelay(guideTiming), [guideTiming]);

  // one slot per letter, left to right, extra gap at each chunk (space) boundary --
  // the word canvas, guide, and stroke-to-letter assignment on Check all key off this
  const wordSlotLayout = useMemo(() => {
    let cursor = 0;
    return letterSequence.map((letter, i) => {
      if (i > 0 && letterSequence[i - 1].chunkIndex !== letter.chunkIndex) cursor += WORD_CHUNK_GAP;
      const x = cursor;
      cursor += WORD_LETTER_SLOT + WORD_LETTER_GAP;
      return { x, width: WORD_LETTER_SLOT };
    });
  }, [letterSequence]);

  const wordCanvasWidth = wordSlotLayout.length === 0 ? 0 : wordSlotLayout[wordSlotLayout.length - 1].x + WORD_LETTER_SLOT;
  const wordCanvasHeight = WORD_LETTER_SLOT + WORD_CAPTION_HEIGHT;

  // shrinks as the word gets longer so the example script (mirroring the single big glyph
  // in character mode) still fits the 760px practice column instead of overflowing it
  const wordGlyphFontSize = Math.max(56, Math.min(140, 640 / Math.max(letterSequence.length, 1)));

  // each letter's guide strokes normalized into its own slot box, then offset into place --
  // same normalizeGuideStrokes used for single-character mode, just laid out side by side
  const wordGuideStrokesBySlot = useMemo(() => {
    return letterSequence.map((letter, i) => {
      const letterData = charactersByRomanization.get(letter.romanization);
      if (!letterData?.guideStrokes?.length) return [];
      const normalized = normalizeGuideStrokes(letterData.guideStrokes, WORD_LETTER_SLOT, 0.78);
      const offsetX = wordSlotLayout[i]?.x ?? 0;
      return normalized.map((stroke) => stroke.map((p) => ({ ...p, x: p.x + offsetX, y: p.y + WORD_CAPTION_HEIGHT })));
    });
  }, [letterSequence, charactersByRomanization, wordSlotLayout]);

  const wordGuidePathsBySlot = useMemo(
    () => wordGuideStrokesBySlot.map((strokes) => strokes.map((s) => smoothStrokePath(s))),
    [wordGuideStrokesBySlot]
  );

  // each letter's demo timing chained after the previous letter's -- computeStrokeTiming's
  // own ~300ms lead-in before a letter's first stroke doubles as the pause between letters
  const wordGuideTimingBySlot = useMemo(() => {
    let cursor = 0;
    return wordGuideStrokesBySlot.map((strokes) => {
      const timing = computeStrokeTiming(strokes).map((t) => ({ delay: t.delay + cursor, duration: t.duration }));
      if (timing.length > 0) cursor = Math.max(...timing.map((t) => t.delay + t.duration));
      return timing;
    });
  }, [wordGuideStrokesBySlot]);

  const wordGuideFadeDelay = useMemo(
    () => demoFadeOutDelay(wordGuideTimingBySlot.flat()),
    [wordGuideTimingBySlot]
  );

  // bumped to force the demo to replay even when the character/word hasn't changed --
  // combined with currentRomanization/currentWordIndex in the key below so switching
  // characters or words also auto-plays
  const [demoReplayCount, setDemoReplayCount] = useState(0);

  const progressByRomanization = {};
  if (progress) {
    for (const c of progress.characters) progressByRomanization[c.romanization] = c;
  }

  const refreshProgress = useCallback(() => {
    if (token) getProgress(token).then(setProgress).catch(console.error);
  }, [token]);

  function handleLogout() {
    setToken(null);
    setAccount(null);
    setCharacters([]);
    setCurrentIndex(0);
    setResult(null);
    setSubmitError(null);
    setProgress(null);
    setHistoryOpen(false);
    setHistory([]);
    setAccountOpen(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setMode("characters");
    setWords([]);
    setCurrentWordIndex(0);
    setWordLetterResults([]);
    setWordLetterMessages([]);
    clear();
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError(null);
    try {
      if (authMode === "signup") await signup(username, email, password);
      const { access_token } = await login(email, password);
      setToken(access_token);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleCheck() {
    if (mode === "words") {
      await handleCheckWord();
      return;
    }
    if (!currentRomanization) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await submitAttempt(token, currentRomanization, getStrokes());
      setResult(data);
      refreshProgress();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // scores every letter that has at least one drawn stroke on the whole-word canvas --
  // strokes are grouped by nearest slot (assignStrokesToSlots), then each group is sent
  // to the same single-character /attempt endpoint used in character mode. scoring
  // re-centers everything on its own bounding box, so the strokes' absolute position on
  // the wide canvas doesn't need to be translated back to a per-letter coordinate space.
  // letters left blank keep their previous result (or stay unattempted) rather than being
  // scored as a hard fail, so Check can be clicked multiple times as the word fills in
  async function handleCheckWord() {
    const bySlot = assignStrokesToSlots(getStrokes(), wordSlotLayout);
    const attempted = letterSequence
      .map((letter, i) => ({ letter, i, strokes: bySlot[i] }))
      .filter((entry) => entry.strokes.length > 0);

    if (attempted.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const results = await Promise.all(
        attempted.map((entry) => submitAttempt(token, entry.letter.romanization, entry.strokes))
      );
      setWordLetterResults((prev) => {
        const updated = [...prev];
        attempted.forEach((entry, idx) => {
          updated[entry.i] = results[idx].passed;
        });
        return updated;
      });
      setWordLetterMessages((prev) => {
        const updated = [...prev];
        attempted.forEach((entry, idx) => {
          updated[entry.i] = results[idx].messages;
        });
        return updated;
      });
      refreshProgress();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(newMode) {
    if (newMode === mode) return;
    setMode(newMode);
    setResult(null);
    setSubmitError(null);
    setHistoryOpen(false);
    clear();
  }

  function goToCharacter(index) {
    setMode("characters");
    setCurrentIndex(index);
    setResult(null);
    setSubmitError(null);
    setHistoryOpen(false);
    clear();
  }

  // prioritizes filling gaps over revisiting weak spots -- a never-attempted character is
  // a bigger practice opportunity than a low score on one you've already tried a few times
  function goToWeakSpot() {
    const unattempted = orderedCharacters.filter((c) => !progressByRomanization[c.romanization]);
    if (unattempted.length > 0) {
      goToCharacter(unattempted[Math.floor(Math.random() * unattempted.length)].index);
      return;
    }

    if (orderedCharacters.length === 0) return;
    let worst = orderedCharacters[0];
    let worstScore = Infinity;
    for (const c of orderedCharacters) {
      const score = progressByRomanization[c.romanization]?.best_shape_score ?? Infinity;
      if (score < worstScore) {
        worstScore = score;
        worst = c;
      }
    }
    goToCharacter(worst.index);
  }

  function goToWord(index) {
    setMode("words");
    setCurrentWordIndex(index);
    setWordLetterResults([]);
    setWordLetterMessages([]);
    setResult(null);
    setSubmitError(null);
    setHistoryOpen(false);
    clear();
  }

  function handleNext() {
    goToCharacter((currentIndex + 1) % orderedCharacters.length);
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setHistory(await getHistory(token, currentRomanization));
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }

  // auth screen
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "380px", padding: "24px" }}>
          <div
            className="font-display"
            style={{
              textAlign: "center",
              fontSize: "22px",
              fontWeight: 500,
              letterSpacing: "0.02em",
              marginBottom: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span className="font-glyph" style={{ color: "var(--sage-deep)" }}>
              ፊ
            </span>{" "}
            Fidel
          </div>

          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: "28px", textAlign: "center", margin: "0 0 8px", letterSpacing: "-0.01em" }}
          >
            {authMode === "login" ? "Sign in to practice" : "Create your account"}
          </h1>
          <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: "14px", margin: "0 0 36px" }}>
            {authMode === "login" ? "Pick up where you left off" : "Start practicing the Fidel script"}
          </p>

          <form onSubmit={handleAuthSubmit}>
            {authMode === "signup" && (
              <div style={{ marginBottom: "16px" }}>
                <label className="label-eyebrow" style={{ display: "block", marginBottom: "6px" }}>
                  Username
                </label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="yourname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            )}
            <div style={{ marginBottom: "16px" }}>
              <label className="label-eyebrow" style={{ display: "block", marginBottom: "6px" }}>
                Email
              </label>
              <input
                className="field-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label className="label-eyebrow" style={{ display: "block", marginBottom: "6px" }}>
                Password
              </label>
              <input
                className="field-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {authError && <p style={{ color: "var(--error)", fontSize: "14px" }}>{authError}</p>}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
              {authMode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "var(--ink-soft)" }}>
            {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                color: "var(--ink)",
                textDecorationLine: "underline",
                textDecorationColor: "var(--line)",
                cursor: "pointer",
              }}
            >
              {authMode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // both modes' guides key off the character list (single glyph in character mode, every
  // letter's guide in word mode), so that's the one load gate that covers either mode
  if (characters.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="font-display" style={{ fontSize: "18px", color: "var(--ink-soft)" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* sidebar -- layout (width/height/scroll) lives in .app-sidebar in theme.css so a
          mobile breakpoint can restack this from a side panel to a capped-height top strip,
          which inline styles can't be overridden by a media query */}
      <div className="app-sidebar">
        <div
          className="font-display"
          style={{
            fontSize: "18px",
            fontWeight: 500,
            marginBottom: "var(--space-tight)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            paddingLeft: "8px",
          }}
        >
          <span className="font-glyph" style={{ color: "var(--sage-deep)" }}>
            ፊ
          </span>
          Fidel Practice
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "var(--space-tight)", paddingLeft: "8px", paddingRight: "8px" }}>
          <button
            className={mode === "characters" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => switchMode("characters")}
            style={{ flex: 1, fontSize: "13px", padding: "8px 12px" }}
          >
            Characters
          </button>
          <button
            className={mode === "words" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => switchMode("words")}
            style={{ flex: 1, fontSize: "13px", padding: "8px 12px" }}
          >
            Words
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "var(--space-tight)", paddingLeft: "8px", paddingRight: "8px" }}>
          <button
            className="btn btn-secondary"
            onClick={() => setAccountOpen(!accountOpen)}
            style={{ flex: 1, fontSize: "13px", padding: "8px 12px" }}
          >
            {accountOpen ? "Hide account" : "Account"}
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ flex: 1, fontSize: "13px", padding: "8px 12px" }}>
            Log out
          </button>
        </div>

        {accountOpen && account && (
          <div
            style={{
              margin: "0 8px var(--space-tight) 8px",
              padding: "10px 0",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              fontSize: "13px",
              color: "var(--ink-soft)",
            }}
          >
            <p style={{ margin: "2px 0", fontWeight: 600 }}>@{account.username}</p>
            <p style={{ margin: "2px 0" }}>{account.email}</p>
          </div>
        )}

        {mode === "characters" && (
          <>
            <div className="label-eyebrow" style={{ marginBottom: "6px", padding: "0 8px" }}>
              Characters
            </div>
            {progress && (
              <div style={{ fontSize: "14px", color: "var(--ink-soft)", marginBottom: "10px", padding: "0 8px" }}>
                {progress.practiced_count} of {progress.total_characters} practiced
              </div>
            )}

            <div style={{ padding: "0 8px", marginBottom: "var(--space-tight)" }}>
              <button className="btn btn-secondary" onClick={goToWeakSpot} style={{ width: "100%", fontSize: "13px", padding: "8px 12px" }}>
                Practice a weak spot
              </button>
            </div>

            {/* one row per consonant family, one column per vowel form, in real Fidel chart
                order (see characterFamilies.js) -- the glyph itself sits in each cell, so
                this doubles as both the navigation list and the progress heatmap instead of
                having two separate views of the same 147 characters. cell color is gray
                (not attempted) or sage-tinted by best shape score; text color is picked
                from that background's actual luminance so the glyph stays legible either way */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "0 8px" }}>
              {groupedCharacters.map((family) => (
                <div key={family.label} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                  {family.members.map((c) => {
                    const p = progressByRomanization[c.romanization];
                    const score = p ? p.best_shape_score : null;
                    const isCurrent = c.index === currentIndex && mode === "characters";
                    const { background, color } = progressCellStyle(score);
                    return (
                      <button
                        key={c.romanization}
                        onClick={() => goToCharacter(c.index)}
                        title={`${c.romanization}: ${score == null ? "not yet attempted" : `best score ${Math.round(score)}`}`}
                        className="font-glyph"
                        style={{
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: isCurrent ? "1.5px solid var(--ink)" : "1.5px solid transparent",
                          borderRadius: "3px",
                          padding: 0,
                          cursor: "pointer",
                          fontSize: "13px",
                          background,
                          color,
                        }}
                      >
                        {c.character}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {mode === "words" && (
          <>
            <div className="label-eyebrow" style={{ marginBottom: "10px", padding: "0 8px" }}>
              Words
            </div>
            {groupedWords.map((group) => (
              <div key={group.category} style={{ marginBottom: "var(--space-tight)" }}>
                <div className="label-eyebrow" style={{ padding: "6px 8px 4px", borderTop: "1px solid var(--line)" }}>
                  {group.category}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {group.items.map((w) => {
                    const isCurrent = w.index === currentWordIndex && mode === "words";
                    return (
                      <li key={w.romanization}>
                        <button
                          onClick={() => goToWord(w.index)}
                          style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            textAlign: "left",
                            padding: "7px 8px",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "14px",
                            fontWeight: isCurrent ? 600 : 400,
                            textDecorationLine: isCurrent ? "underline" : "none",
                            textDecorationColor: "var(--sage-deep)",
                            textDecorationThickness: "2px",
                            textUnderlineOffset: "4px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--ink)",
                          }}
                        >
                          <span>
                            <span className="font-glyph" style={{ marginRight: "6px" }}>
                              {w.text}
                            </span>
                            <span style={{ color: "var(--ink-soft)" }}>{w.romanization}</span>
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>{w.meaning}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>

      {/* main practice area */}
      <div className="app-main">
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {mode === "words" && currentWordData && (
            <div style={{ textAlign: "center", marginBottom: "var(--space-medium)" }}>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "14px" }}
              >
                <div className="label-eyebrow">
                  {currentWordData.meaning} &middot; {letterSequence.length} {letterSequence.length === 1 ? "letter" : "letters"}
                </div>
                {/* replays the whole word's stroke-order demo -- bumping demoReplayCount
                    changes the <g> key below, forcing it to remount and restart */}
                <button
                  type="button"
                  onClick={() => setDemoReplayCount((n) => n + 1)}
                  title="Watch it drawn again"
                  aria-label="Watch it drawn again"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    border: "1px solid var(--line)",
                    borderRadius: "50%",
                    background: "transparent",
                    color: "var(--sage-deep)",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  ▶
                </button>
              </div>

              {/* example script, same role as the single big glyph in character mode --
                  sized down as the word gets longer so it still fits the practice column */}
              <div
                className="font-glyph"
                style={{
                  fontSize: `${wordGlyphFontSize}px`,
                  lineHeight: 1,
                  color: "var(--ink)",
                  margin: "0 0 var(--space-medium)",
                  userSelect: "none",
                }}
              >
                {currentWordData.text}
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-tight)", overflowX: "auto" }}>
                {/* corner-tick frame around the writing surface, like a bordered page rather
                    than a plain input box -- see .page-frame in theme.css */}
                <div className="page-frame">
                  <span className="page-frame-tick-tr" />
                  <span className="page-frame-tick-bl" />
                  <div
                    style={{
                      width: wordCanvasWidth,
                      height: wordCanvasHeight,
                      border: "1.5px solid var(--ink)", // the one element that gets a real border -- it's the writing surface
                      background: "white",
                      position: "relative",
                    }}
                  >
                    {/* one wide canvas holding every letter of the word in its own slot,
                        instead of cycling through a separate single-letter canvas per
                        letter -- same ghost + self-drawing demo idea as character mode
                        (see strokeGeometry.js), just laid out side by side and chained in
                        sequence so the whole word "writes itself" once per load/replay */}
                    <svg
                      aria-hidden="true"
                      width={wordCanvasWidth}
                      height={wordCanvasHeight}
                      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                    >
                      {letterSequence.map((letter, i) => (
                        <text
                          key={`cap-${i}`}
                          x={wordSlotLayout[i].x + wordSlotLayout[i].width / 2}
                          y={11}
                          textAnchor="middle"
                          fontFamily="Fraunces, serif"
                          fontStyle="italic"
                          fontWeight={500}
                          fontSize={11}
                          fill="var(--sage-deep)"
                        >
                          {letter.romanization}
                        </text>
                      ))}
                      {/* faint divider between adjacent slots within the same chunk -- no
                          divider across a word-space gap, the extra gap already reads as one */}
                      {wordSlotLayout.slice(1).map((slot, i) => {
                        if (letterSequence[i].chunkIndex !== letterSequence[i + 1].chunkIndex) return null;
                        const x = slot.x - WORD_LETTER_GAP / 2;
                        return (
                          <line key={`div-${i}`} x1={x} y1={WORD_CAPTION_HEIGHT + 4} x2={x} y2={wordCanvasHeight - 4} stroke="var(--line)" strokeWidth={1} />
                        );
                      })}
                      {wordGuidePathsBySlot.flat().map((d, i) => (
                        <path key={i} d={d} fill="none" stroke="var(--ink)" strokeOpacity={0.14} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {/* fades out after holding the finished word briefly, handing off to
                          the plain ghost above as the guide the user actually traces over */}
                      <g
                        key={`word-${currentWordIndex}-${demoReplayCount}`}
                        style={{ animation: `demo-fade-out ${DEMO_FADE_MS}ms ease-in ${wordGuideFadeDelay}ms 1 forwards` }}
                      >
                        {wordGuideStrokesBySlot.map((strokes, slotIndex) =>
                          strokes.map((stroke, strokeIndex) => {
                            const d = wordGuidePathsBySlot[slotIndex][strokeIndex];
                            const { delay, duration } = wordGuideTimingBySlot[slotIndex]?.[strokeIndex] ?? { delay: 0, duration: 400 };
                            const start = stroke[0];
                            return (
                              <g key={`${slotIndex}-${strokeIndex}`}>
                                <path
                                  d={d}
                                  fill="none"
                                  stroke="var(--sage-deep)"
                                  strokeWidth={4}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  pathLength={1}
                                  style={{
                                    strokeDasharray: 1,
                                    animation: `stroke-reveal ${duration}ms linear ${delay}ms 1 both`,
                                  }}
                                />
                                {start && (
                                  <circle
                                    cx={start.x}
                                    cy={start.y}
                                    r={3.5}
                                    fill="var(--sage-deep)"
                                    style={{ animation: `dot-reveal 150ms linear ${delay}ms 1 both` }}
                                  />
                                )}
                              </g>
                            );
                          })
                        )}
                      </g>
                    </svg>
                    <canvas
                      ref={canvasRef}
                      width={wordCanvasWidth}
                      height={wordCanvasHeight}
                      {...handlers}
                      style={{ position: "relative", background: "transparent", touchAction: "none" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                {letterSequence.map((_, i) => {
                  const letterResult = wordLetterResults[i];
                  const passed = letterResult === true;
                  return (
                    <span
                      key={i}
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: 700,
                        lineHeight: 1,
                        color: passed ? "var(--paper)" : letterResult === false ? "var(--paper)" : "transparent",
                        background: passed ? "var(--sage-deep)" : letterResult === false ? "var(--ink-soft)" : "var(--line)",
                      }}
                    >
                      {passed ? "✓" : letterResult === false ? "×" : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "characters" && (
            <>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "-6px" }}
              >
                <div className="glyph-caption" style={{ fontSize: "16px" }}>
                  {currentRomanization}
                </div>
                {/* replays the stroke-order demo without waiting for a character change --
                    bumping demoReplayCount changes the <g> key below, forcing it to remount
                    and restart its CSS animations from scratch */}
                <button
                  type="button"
                  onClick={() => setDemoReplayCount((n) => n + 1)}
                  title="Watch it drawn again"
                  aria-label="Watch it drawn again"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    border: "1px solid var(--line)",
                    borderRadius: "50%",
                    background: "transparent",
                    color: "var(--sage-deep)",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  ▶
                </button>
              </div>

              {/* glyph is the focal point -- no box/border, sits straight on the page, much
                  bigger than anything else */}
              <div
                className="font-glyph"
                style={{ textAlign: "center", fontSize: "220px", lineHeight: 1, color: "var(--ink)", margin: "0 0 var(--space-tight)", userSelect: "none" }}
              >
                {currentCharacter}
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-medium)" }}>
                {/* corner-tick frame around the writing surface, like a bordered page rather
                    than a plain input box -- see .page-frame in theme.css */}
                <div className="page-frame">
                  <span className="page-frame-tick-tr" />
                  <span className="page-frame-tick-bl" />
                  <div
                    style={{
                      width: CANVAS_SIZE,
                      height: CANVAS_SIZE,
                      border: "1.5px solid var(--ink)", // the one element that gets a real border -- it's the writing surface
                      background: "white",
                      position: "relative",
                    }}
                  >
                    {/* tracing guide behind the canvas -- a faint always-on "ghost" of the full
                        character, plus a colored version that draws itself in stroke-by-stroke
                        on the real recorded pacing (see strokeGeometry.js), then stays fully
                        drawn as the trace target. both are smoothed splines through the
                        recorded points, not the raw jittery polyline, and both are traced from
                        the actual recorded reference strokes (not a font glyph) so tracing
                        this closely is, by construction, what gets scored well */}
                    <svg
                      aria-hidden="true"
                      width={CANVAS_SIZE - 3}
                      height={CANVAS_SIZE - 3}
                      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                    >
                      {guidePaths.map((d, i) => (
                        <path key={i} d={d} fill="none" stroke="var(--ink)" strokeOpacity={0.14} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {/* fades out after holding the finished character briefly, handing off
                          to the plain ghost above as the guide the user actually traces over */}
                      <g
                        key={`${currentRomanization}-${demoReplayCount}`}
                        style={{ animation: `demo-fade-out ${DEMO_FADE_MS}ms ease-in ${guideFadeDelay}ms 1 forwards` }}
                      >
                        {guidePaths.map((d, i) => {
                          const { delay, duration } = guideTiming[i] ?? { delay: 0, duration: 400 };
                          const start = guideStrokes[i]?.[0];
                          return (
                            <g key={i}>
                              <path
                                d={d}
                                fill="none"
                                stroke="var(--sage-deep)"
                                strokeWidth={5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                pathLength={1}
                                style={{
                                  strokeDasharray: 1,
                                  animation: `stroke-reveal ${duration}ms linear ${delay}ms 1 both`,
                                }}
                              />
                              {start && (
                                <circle
                                  cx={start.x}
                                  cy={start.y}
                                  r={4}
                                  fill="var(--sage-deep)"
                                  style={{ animation: `dot-reveal 150ms linear ${delay}ms 1 both` }}
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_SIZE - 3}
                      height={CANVAS_SIZE - 3}
                      {...handlers}
                      style={{ position: "relative", background: "transparent", touchAction: "none" }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === "characters" && result && (
            <div
              style={{
                borderTop: "1px solid var(--ink)",
                paddingTop: "var(--space-medium)",
                paddingBottom: "var(--space-tight)",
                marginBottom: "var(--space-medium)",
                textAlign: "center",
              }}
            >
              {/* just pass/fail as the headline, no raw scores -- felt clinical with numbers */}
              <p
                className="font-display"
                style={{ fontSize: "26px", fontWeight: 500, color: result.passed ? "var(--sage-deep)" : "var(--ink-soft)", margin: "0 0 10px" }}
              >
                {result.passed ? "✓ Well done!" : "Try again."}
              </p>
              {result.messages && result.messages.length > 0 && (
                <div style={{ maxWidth: "480px", margin: "0 auto" }}>
                  {result.messages.map((m, i) => (
                    <p key={i} className="feedback-text" style={{ margin: "4px 0" }}>
                      {m}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* per-letter detail for whichever letters last came back failed -- only the
              failed ones, so a mostly-right word doesn't bury the useful feedback */}
          {mode === "words" && wordLetterResults.some((r) => r === false) && (
            <div
              style={{
                borderTop: "1px solid var(--ink)",
                paddingTop: "var(--space-medium)",
                paddingBottom: "var(--space-tight)",
                marginBottom: "var(--space-medium)",
                textAlign: "left",
                maxWidth: "480px",
                margin: "0 auto var(--space-medium)",
              }}
            >
              {letterSequence.map((letter, i) => {
                if (wordLetterResults[i] !== false) return null;
                const msgs = wordLetterMessages[i];
                if (!msgs || msgs.length === 0) return null;
                return (
                  <div key={i} style={{ marginBottom: "10px" }}>
                    <div className="glyph-caption" style={{ fontSize: "12px", marginBottom: "2px" }}>
                      {letter.romanization}
                    </div>
                    {msgs.map((m, mi) => (
                      <p key={mi} className="feedback-text" style={{ margin: "2px 0", fontSize: "14px" }}>
                        {m}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {submitError && <p style={{ color: "var(--error)", fontSize: "14px", textAlign: "center" }}>{submitError}</p>}

          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "var(--space-medium)" }}>
            <button className="btn btn-secondary" onClick={undo} disabled={strokes.length === 0}>
              Undo
            </button>
            <button className="btn btn-secondary" onClick={clear}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handleCheck} disabled={submitting || strokes.length === 0}>
              {submitting ? "Checking…" : "Check"}
            </button>
            {mode === "characters" && (
              <button className="btn btn-secondary" onClick={handleNext}>
                Next character
              </button>
            )}
            {mode === "characters" && (
              <button className="btn btn-secondary" onClick={toggleHistory}>
                {historyOpen ? "Hide history" : "Show history"}
              </button>
            )}
          </div>

          {wordComplete && (
            <div
              style={{
                textAlign: "center",
                marginBottom: "var(--space-medium)",
                paddingTop: "var(--space-tight)",
                borderTop: "1px solid var(--line)",
              }}
            >
              <p
                className="font-display"
                style={{
                  fontSize: "18px",
                  margin: "0 0 10px",
                  color: wordPassedCount === letterSequence.length ? "var(--sage-deep)" : "var(--ink-soft)",
                }}
              >
                {wordPassedCount} of {letterSequence.length} letters passed
              </p>
              <button className="btn btn-secondary" onClick={() => goToWord(currentWordIndex)} style={{ fontSize: "13px" }}>
                Practice again
              </button>
            </div>
          )}

          {mode === "characters" && historyOpen && (
            <div style={{ textAlign: "left", borderTop: "1px solid var(--ink)", paddingTop: "var(--space-tight)" }}>
              <div className="label-eyebrow" style={{ marginBottom: "12px" }}>
                History for {currentCharacter} ({currentRomanization})
              </div>
              {historyLoading && <p style={{ color: "var(--ink-soft)", fontSize: "14px" }}>Loading…</p>}
              {!historyLoading && history.length === 0 && (
                <p style={{ color: "var(--ink-soft)", fontSize: "14px" }}>No attempts yet for this character.</p>
              )}
              {!historyLoading && history.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: "1px solid var(--line)", textAlign: "left", padding: "6px 4px", color: "var(--ink-soft)", fontWeight: 500 }}>
                        When
                      </th>
                      <th style={{ borderBottom: "1px solid var(--line)", textAlign: "left", padding: "6px 4px", color: "var(--ink-soft)", fontWeight: 500 }}>
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const passed = h.shape_score >= PASS_THRESHOLD;
                      return (
                        <tr key={h.id}>
                          <td style={{ padding: "6px 4px", color: "var(--ink-soft)" }}>{new Date(h.created_at).toLocaleString()}</td>
                          <td style={{ padding: "6px 4px", color: passed ? "var(--sage-deep)" : "var(--ink-soft)", fontWeight: 600 }}>
                            {passed ? "✓ Passed" : "Try again"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

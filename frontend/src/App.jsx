import { useEffect, useState, useCallback, useMemo } from "react";
import { signup, login, getCharacters, getWords, submitAttempt, getProgress, getHistory, getMe } from "./api";
import { useStrokeCanvas } from "./useStrokeCanvas";
import { CHARACTER_FAMILIES } from "./characterFamilies";

const CANVAS_SIZE = 280;
const PASS_THRESHOLD = 70; // matches backend's feedback.js threshold

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
    }))
  );
}

// direction near the end of a stroke -- averaged over the last few points instead of
// just the last two, so it isn't thrown off by a single jittery sample at the tail
function strokeEndDirection(stroke, lookback = 6) {
  const end = stroke[stroke.length - 1];
  const start = stroke[Math.max(0, stroke.length - 1 - lookback)];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

// triangle points for an arrowhead at the end of a stroke, pointing in its draw direction
function arrowheadPoints(stroke, size = 9, width = 7) {
  const end = stroke[stroke.length - 1];
  const { dx, dy } = strokeEndDirection(stroke);
  const backX = end.x - dx * size;
  const backY = end.y - dy * size;
  const perpX = -dy;
  const perpY = dx;
  return [
    `${end.x},${end.y}`,
    `${backX + (perpX * width) / 2},${backY + (perpY * width) / 2}`,
    `${backX - (perpX * width) / 2},${backY - (perpY * width) / 2}`,
  ].join(" ");
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

  // word/phrase practice -- a word is just its letters traced in sequence through the
  // same single-character flow, so this only needs to track position within the word
  const [mode, setMode] = useState("characters"); // "characters" | "words"
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [wordLetterResults, setWordLetterResults] = useState([]); // parallel to letterSequence: null | true | false

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

  const isLastLetter = mode === "words" && currentLetterIndex === letterSequence.length - 1;
  const wordComplete =
    mode === "words" && letterSequence.length > 0 && letterSequence.every((_, i) => wordLetterResults[i] != null);
  const wordPassedCount = wordLetterResults.filter((r) => r === true).length;

  // single source of truth for "what's on the canvas right now" -- a character selected
  // directly, or the current letter of the word being practiced
  const activeCharacterData =
    mode === "words"
      ? charactersByRomanization.get(letterSequence[currentLetterIndex]?.romanization) ?? null
      : orderedCharacters[currentIndex] ?? null;
  const currentRomanization = activeCharacterData?.romanization ?? null;
  const currentCharacter = activeCharacterData?.character ?? null;

  // leave ~15% margin around the traced guide so it doesn't touch the canvas edge
  const guideStrokes = useMemo(() => {
    if (!activeCharacterData?.guideStrokes?.length) return [];
    return normalizeGuideStrokes(activeCharacterData.guideStrokes, CANVAS_SIZE - 3);
  }, [activeCharacterData]);

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
    setCurrentLetterIndex(0);
    setWordLetterResults([]);
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
    if (!currentRomanization) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await submitAttempt(token, currentRomanization, getStrokes());
      setResult(data);
      if (mode === "words") {
        setWordLetterResults((prev) => {
          const updated = [...prev];
          updated[currentLetterIndex] = data.passed;
          return updated;
        });
      }
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

  function goToWord(index) {
    setMode("words");
    setCurrentWordIndex(index);
    setCurrentLetterIndex(0);
    setWordLetterResults([]);
    setResult(null);
    setSubmitError(null);
    setHistoryOpen(false);
    clear();
  }

  function handleNext() {
    if (mode === "words") {
      if (isLastLetter) return;
      setCurrentLetterIndex((i) => i + 1);
      setResult(null);
      setSubmitError(null);
      clear();
    } else {
      goToCharacter((currentIndex + 1) % orderedCharacters.length);
    }
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

  if (!currentRomanization) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="font-display" style={{ fontSize: "18px", color: "var(--ink-soft)" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* sidebar */}
      <div
        style={{
          width: "260px",
          borderRight: "2px solid var(--sage)",
          padding: "var(--space-medium) var(--space-tight)",
          overflowY: "auto",
          height: "100vh",
          boxSizing: "border-box",
          flexShrink: 0,
          background: "var(--paper-deep)",
        }}
      >
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
            {progress && (
              <div style={{ marginBottom: "var(--space-medium)", padding: "0 8px" }}>
                <div className="label-eyebrow" style={{ marginBottom: "6px" }}>
                  Progress
                </div>
                <div style={{ fontSize: "14px", color: "var(--ink-soft)", marginBottom: "8px" }}>
                  {progress.practiced_count} of {progress.total_characters} practiced
                </div>
                {/* one row per consonant family, one column per vowel form -- same shape as
                    the traditional Fidel chart. gray = not attempted, sage intensity = best
                    shape score, so mastery across the whole alphabet reads at a glance */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                  {orderedCharacters.map((c) => {
                    const p = progressByRomanization[c.romanization];
                    const score = p ? p.best_shape_score : null;
                    return (
                      <button
                        key={c.romanization}
                        onClick={() => goToCharacter(c.index)}
                        title={`${c.romanization} — ${score == null ? "not yet attempted" : `best score ${Math.round(score)}`}`}
                        style={{
                          aspectRatio: "1",
                          border: "none",
                          borderRadius: "2px",
                          padding: 0,
                          cursor: "pointer",
                          background: score == null ? "var(--line)" : "var(--sage-deep)",
                          opacity: score == null ? 1 : Math.max(0.15, score / 100),
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="label-eyebrow" style={{ marginBottom: "10px", padding: "0 8px" }}>
              Characters
            </div>
            {groupedCharacters.map((family) => (
              <div key={family.label} style={{ marginBottom: "var(--space-tight)" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 8px 2px",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span className="font-glyph" style={{ fontSize: "15px", color: "var(--sage-deep)" }}>
                    {family.members[0].character}
                  </span>
                  <span className="label-eyebrow">{family.label}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {family.members.map((c) => {
                    const p = progressByRomanization[c.romanization];
                    const isCurrent = c.index === currentIndex;
                    const passed = p ? p.best_shape_score >= PASS_THRESHOLD : false;
                    return (
                      <li key={c.romanization}>
                        <button
                          onClick={() => goToCharacter(c.index)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            textAlign: "left",
                            padding: "7px 8px",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "14px",
                            fontWeight: isCurrent ? 600 : 400,
                            // active state is text weight + underline, not a colored box --
                            // keeps it in the same typographic language as everything else.
                            // longhand textDecorationLine (not the textDecoration shorthand) --
                            // mixing shorthand + longhand decoration props in the same style
                            // object trips a react warning when isCurrent toggles between renders
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
                              {c.character}
                            </span>
                            <span style={{ color: "var(--ink-soft)" }}>{c.romanization}</span>
                          </span>
                          {passed ? (
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--sage-deep)" }} aria-label="Passed">
                              ✓
                            </span>
                          ) : (
                            p && (
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: "var(--ink-soft)",
                                  display: "inline-block",
                                }}
                                aria-label="Attempted, not yet passed"
                              />
                            )
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
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
      <div style={{ flex: 1, padding: "var(--space-generous)", height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {mode === "words" && currentWordData && (
            <div style={{ textAlign: "center", marginBottom: "var(--space-tight)" }}>
              <div className="label-eyebrow" style={{ marginBottom: "10px" }}>
                {currentWordData.meaning} &middot; letter {currentLetterIndex + 1} of {letterSequence.length}
              </div>
              {/* the full word, current letter highlighted -- built from the same
                  per-letter data as the canvas below rather than the raw text string,
                  so highlighting always lines up with what's actually being scored */}
              <div className="font-glyph" style={{ fontSize: "44px", lineHeight: 1, userSelect: "none" }}>
                {letterSequence.map((letter, i) => {
                  const letterData = charactersByRomanization.get(letter.romanization);
                  const needsGapBefore = i > 0 && letterSequence[i - 1].chunkIndex !== letter.chunkIndex;
                  return (
                    <span
                      key={i}
                      style={{
                        marginLeft: needsGapBefore ? "0.35em" : 0,
                        color: i === currentLetterIndex ? "var(--sage-deep)" : "var(--ink)",
                        opacity: i === currentLetterIndex ? 1 : 0.4,
                      }}
                    >
                      {letterData?.character ?? "?"}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "8px" }}>
                {letterSequence.map((_, i) => {
                  const letterResult = wordLetterResults[i];
                  return (
                    <span
                      key={i}
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        boxSizing: "border-box",
                        background: letterResult === true ? "var(--sage-deep)" : letterResult === false ? "var(--ink-soft)" : "var(--line)",
                        border: i === currentLetterIndex ? "1.5px solid var(--sage-deep)" : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="label-eyebrow" style={{ textAlign: "center", marginBottom: "4px" }}>
            {currentRomanization}
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
            <div
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                border: "1.5px solid var(--ink)", // the one element that gets a real border -- it's the writing surface
                background: "white",
                position: "relative",
              }}
            >
              {/* faded tracing guide behind the canvas, kindergarten-worksheet style --
                  traced from the actual recorded reference strokes (not the font glyph)
                  so tracing this guide closely is, by construction, what gets scored well.
                  dotted path + arrowhead show the draw direction, numbered circle shows
                  stroke order -- same idea as a kids' handwriting worksheet */}
              <svg
                aria-hidden="true"
                width={CANVAS_SIZE - 3}
                height={CANVAS_SIZE - 3}
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              >
                {guideStrokes.map((stroke, i) => {
                  const start = stroke[0];
                  return (
                    <g key={i}>
                      <polyline
                        points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="var(--ink)"
                        strokeOpacity={0.22}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="1 9"
                      />
                      <polygon points={arrowheadPoints(stroke)} fill="var(--sage-deep)" fillOpacity={0.55} />
                      <circle
                        cx={start.x}
                        cy={start.y}
                        r={8}
                        fill="var(--sage-tint)"
                        fillOpacity={0.85}
                        stroke="var(--sage-deep)"
                        strokeOpacity={0.6}
                      />
                      <text
                        x={start.x}
                        y={start.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={10}
                        fontFamily="Inter, sans-serif"
                        fontWeight={600}
                        fill="var(--sage-deep)"
                        fillOpacity={0.85}
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
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

          {result && (
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
            {mode === "words" ? (
              <button className="btn btn-secondary" onClick={handleNext} disabled={isLastLetter}>
                Next letter
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handleNext}>
                Next character
              </button>
            )}
            <button className="btn btn-secondary" onClick={toggleHistory}>
              {historyOpen ? "Hide history" : "Show history"}
            </button>
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

          {historyOpen && (
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

// groups the characters into their consonant families (7 vowel forms each), matching how
// the Fidel chart is actually taught -- replaces the flat alphabetical sidebar list, which
// scattered related characters apart (e.g. sorting split "s" and "sh" apart since "sh*"
// alphabetizes between "see" and "si").
// each family's first entry is its bare/representative form, shown as the section header.
//
// both the family (row) order and the vowel-form (column) order below are the real
// Ge'ez/Amharic fidel chart order -- derived from the Unicode Ethiopic block, which
// assigns each family a contiguous range of code points in traditional recitation
// order, and each family's 7 vowel forms in traditional order within that range
// (verified against every character actually in reference_data/, by codepoint --
// not assumed). that's why it starts with "h" (ሀ, U+1200, the first Ethiopic code
// point) rather than "a", and why each row reads [1st order, u, i, a, e, bare
// consonant, o] rather than alphabetically by romanization.
//
// includes the 6 families added after the initial 147-character recording: k, ny
// (palatalized n), and 4 historical duplicate letters that sound the same as another
// family in modern Amharic but are written as distinct glyphs -- h2 (2nd h,
// pharyngeal ḥa ሐ), s2 (2nd s, śa ሠ), a2 (2nd glottal, ʿayin ዐ), and ts2 (2nd tse,
// ṣ́a ጸ). romanization for these uses a "2" suffix, same convention as the
// pre-existing p/p2 pair (different glyph, same-ish sound).
export const CHARACTER_FAMILIES = [
  ["ha", "hu", "hi", "haa", "he", "h", "ho"],
  ["le", "lu", "li", "la", "lee", "l", "lo"],
  ["he2", "hu2", "hi2", "ha2", "hee2", "h2", "ho2"],
  ["me", "mu", "mi", "ma", "mee", "m", "mo"],
  ["se2", "su2", "si2", "sa2", "see2", "s2", "so2"],
  ["re", "ru", "ri", "ra", "ree", "r", "ro"],
  ["se", "su", "si", "sa", "see", "s", "so"],
  ["she", "shu", "shi", "sha", "shee", "sh", "sho"],
  ["qe", "qu", "qi", "qa", "qee", "q", "qo"],
  ["be", "bu", "bi", "ba", "bee", "b", "bo"],
  ["te", "tu", "ti", "ta", "tee", "t", "to"],
  ["ne", "nu", "ni", "na", "nee", "n", "no"],
  ["nye", "nyu", "nyi", "nya", "nyee", "ny", "nyo"],
  ["a", "u", "i", "aa", "e", "ie", "o"],
  ["ke", "ku", "ki", "ka", "kee", "k", "ko"],
  ["we", "wu", "wi", "wa", "wee", "w", "wo"],
  ["a2", "u2", "i2", "aa2", "e2", "ie2", "o2"],
  ["ye", "yu", "yi", "ya", "yee", "y", "yo"],
  ["de", "du", "di", "da", "dee", "d", "do"],
  ["je", "ju", "ji", "ja", "jee", "j", "jo"],
  ["ge", "gu", "gi", "ga", "gee", "g", "go"],
  ["te'", "tu'", "ti'", "ta'", "te'e", "t'", "to'"],
  ["pe", "pu", "pi", "pa", "pee", "p", "po"],
  ["tse2", "tsu2", "tsi2", "tsa2", "tsee2", "ts2", "tso2"],
  ["tse", "tsu", "tsi", "tsa", "tsee", "ts", "tso"],
  ["fe", "fu", "fi", "fa", "fee", "f", "fo"],
  ["pe2", "pu2", "pi2", "pa2", "pee2", "p2", "po2"],
];

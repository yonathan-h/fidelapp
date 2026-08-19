// groups the 147 characters into their 21 consonant families (7 vowel forms each),
// matching how the Fidel chart is actually taught -- replaces the flat alphabetical
// sidebar list, which scattered related characters apart (e.g. sorting split "s" and
// "sh" apart since "sh*" alphabetizes between "see" and "si").
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
export const CHARACTER_FAMILIES = [
  ["ha", "hu", "hi", "haa", "he", "h", "ho"],
  ["le", "lu", "li", "la", "lee", "l", "lo"],
  ["me", "mu", "mi", "ma", "mee", "m", "mo"],
  ["re", "ru", "ri", "ra", "ree", "r", "ro"],
  ["se", "su", "si", "sa", "see", "s", "so"],
  ["she", "shu", "shi", "sha", "shee", "sh", "sho"],
  ["qe", "qu", "qi", "qa", "qee", "q", "qo"],
  ["be", "bu", "bi", "ba", "bee", "b", "bo"],
  ["te", "tu", "ti", "ta", "tee", "t", "to"],
  ["ne", "nu", "ni", "na", "nee", "n", "no"],
  ["a", "u", "i", "aa", "e", "ie", "o"],
  ["we", "wu", "wi", "wa", "wee", "w", "wo"],
  ["ye", "yu", "yi", "ya", "yee", "y", "yo"],
  ["de", "du", "di", "da", "dee", "d", "do"],
  ["je", "ju", "ji", "ja", "jee", "j", "jo"],
  ["ge", "gu", "gi", "ga", "gee", "g", "go"],
  ["te'", "tu'", "ti'", "ta'", "te'e", "t'", "to'"],
  ["pe", "pu", "pi", "pa", "pee", "p", "po"],
  ["tse", "tsu", "tsi", "tsa", "tsee", "ts", "tso"],
  ["fe", "fu", "fi", "fa", "fee", "f", "fo"],
  ["pe2", "pu2", "pi2", "pa2", "pee2", "p2", "po2"],
];

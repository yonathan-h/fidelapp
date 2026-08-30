// curated word list for word/phrase practice -- each word is composed entirely of
// characters that already exist in reference_data, so practicing a word is just
// tracing its letters in sequence through the existing single-character scoring flow.
// no new reference stroke data needed.
//
// "chunks" is an array of sub-words (more than one only for space-separated phrases,
// e.g. "how are you"), each an ordered list of single-character romanizations. words
// were checked against reference_data by hand. as of the 42-character addition (k, ny,
// and 4 historical duplicate letters -- see characterFamilies.js), most common words
// that were previously blocked on missing letters can now be added; a few obscure
// historical-duplicate-heavy words may still be missing.
export const WORDS = [
  { text: "አንድ", romanization: "and", meaning: "one", category: "Numbers", chunks: [["a", "n", "d"]] },
  { text: "ሁለት", romanization: "hulet", meaning: "two", category: "Numbers", chunks: [["hu", "le", "t"]] },
  { text: "ሶስት", romanization: "sost", meaning: "three", category: "Numbers", chunks: [["so", "s", "t"]] },
  { text: "አራት", romanization: "arat", meaning: "four", category: "Numbers", chunks: [["a", "ra", "t"]] },
  { text: "አምስት", romanization: "amist", meaning: "five", category: "Numbers", chunks: [["a", "m", "s", "t"]] },
  { text: "ስድስት", romanization: "sidist", meaning: "six", category: "Numbers", chunks: [["s", "d", "s", "t"]] },
  { text: "ሰባት", romanization: "sebat", meaning: "seven", category: "Numbers", chunks: [["se", "ba", "t"]] },
  { text: "ስምንት", romanization: "siminit", meaning: "eight", category: "Numbers", chunks: [["s", "m", "n", "t"]] },
  { text: "አስር", romanization: "asir", meaning: "ten", category: "Numbers", chunks: [["a", "s", "r"]] },

  { text: "እናት", romanization: "enat", meaning: "mother", category: "Family", chunks: [["ie", "na", "t"]] },
  { text: "አባት", romanization: "abat", meaning: "father", category: "Family", chunks: [["a", "ba", "t"]] },
  { text: "ወንድም", romanization: "wendim", meaning: "brother", category: "Family", chunks: [["we", "n", "d", "m"]] },
  { text: "እህት", romanization: "ehit", meaning: "sister", category: "Family", chunks: [["ie", "h", "t"]] },
  { text: "ልጅ", romanization: "lij", meaning: "child", category: "Family", chunks: [["l", "j"]] },
  { text: "ባል", romanization: "bal", meaning: "husband", category: "Family", chunks: [["ba", "l"]] },
  { text: "ሚስት", romanization: "mist", meaning: "wife", category: "Family", chunks: [["mi", "s", "t"]] },

  { text: "ሰላም", romanization: "selam", meaning: "hello / peace", category: "Greetings", chunks: [["se", "la", "m"]] },
  { text: "አዎ", romanization: "awo", meaning: "yes", category: "Greetings", chunks: [["a", "wo"]] },
  { text: "የለም", romanization: "yelem", meaning: "no", category: "Greetings", chunks: [["ye", "le", "m"]] },
  { text: "ይቅርታ", romanization: "yikirta", meaning: "sorry / excuse me", category: "Greetings", chunks: [["y", "q", "r", "ta"]] },
  {
    text: "አመሰግናለሁ",
    romanization: "ameseginalehu",
    meaning: "thank you",
    category: "Greetings",
    chunks: [["a", "me", "se", "g", "na", "le", "hu"]],
  },
  {
    text: "እንደምን አለህ",
    romanization: "endemin aleh",
    meaning: "how are you (to a male)",
    category: "Greetings",
    chunks: [
      ["ie", "n", "de", "m", "n"],
      ["a", "le", "h"],
    ],
  },
  {
    text: "እንደምን አለሽ",
    romanization: "endemin alesh",
    meaning: "how are you (to a female)",
    category: "Greetings",
    chunks: [
      ["ie", "n", "de", "m", "n"],
      ["a", "le", "sh"],
    ],
  },

  { text: "አርብ", romanization: "arb", meaning: "Friday", category: "Days of the week", chunks: [["a", "r", "b"]] },
  { text: "ቅዳሜ", romanization: "kidame", meaning: "Saturday", category: "Days of the week", chunks: [["q", "da", "mee"]] },
  { text: "እሁድ", romanization: "ehud", meaning: "Sunday", category: "Days of the week", chunks: [["ie", "hu", "d"]] },
];

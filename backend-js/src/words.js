// curated word list for word/phrase practice -- each word is composed entirely of
// characters that already exist in reference_data, so practicing a word is just
// tracing its letters in sequence through the existing single-character scoring flow.
// no new reference stroke data needed.
//
// "chunks" is an array of sub-words (more than one only for space-separated phrases,
// e.g. "how are you"), each an ordered list of single-character romanizations. words
// were checked against reference_data by hand (see test/words.test.js for the
// programmatic version of that check). as of the 217-character set (z/ch/ch'/zh added
// 2026-09-20, see characterFamilies.js), most common words are constructible -- the
// remaining gap is labialized/"wa"-form glyphs (ቋ/ሷ/ጓ etc.), which block a handful of
// words noted inline below (e.g. "she", "green").
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
  {
    text: "ደህና ሁን",
    romanization: "dehna hun",
    meaning: "goodbye (to a male)",
    category: "Greetings",
    chunks: [
      ["de", "h", "na"],
      ["hu", "n"],
    ],
  },
  {
    text: "ደህና ሁኚ",
    romanization: "dehna hunyi",
    meaning: "goodbye (to a female)",
    category: "Greetings",
    chunks: [
      ["de", "h", "na"],
      ["hu", "nyi"],
    ],
  },
  { text: "እባክህ", romanization: "ibakih", meaning: "please (to a male)", category: "Greetings", chunks: [["ie", "ba", "k", "h"]] },
  { text: "እባክሽ", romanization: "ibakish", meaning: "please (to a female)", category: "Greetings", chunks: [["ie", "ba", "k", "sh"]] },

  { text: "ሰኞ", romanization: "segno", meaning: "Monday", category: "Days of the week", chunks: [["se", "nyo"]] },
  { text: "ማክሰኞ", romanization: "maksegno", meaning: "Tuesday", category: "Days of the week", chunks: [["ma", "k", "se", "nyo"]] },
  { text: "ረቡዕ", romanization: "rebu", meaning: "Wednesday", category: "Days of the week", chunks: [["re", "bu", "ie2"]] },
  { text: "ሐሙስ", romanization: "hamus", meaning: "Thursday", category: "Days of the week", chunks: [["he2", "mu", "s"]] },
  { text: "አርብ", romanization: "arb", meaning: "Friday", category: "Days of the week", chunks: [["a", "r", "b"]] },
  { text: "ቅዳሜ", romanization: "kidame", meaning: "Saturday", category: "Days of the week", chunks: [["q", "da", "mee"]] },
  { text: "እሁድ", romanization: "ehud", meaning: "Sunday", category: "Days of the week", chunks: [["ie", "hu", "d"]] },

  // "she" (እሷ) is excluded -- needs a labialized glyph (ሷ) not yet recorded
  { text: "እኔ", romanization: "ene", meaning: "I", category: "Pronouns", chunks: [["ie", "nee"]] },
  { text: "አንተ", romanization: "ante", meaning: "you (to a male)", category: "Pronouns", chunks: [["a", "n", "te"]] },
  { text: "አንቺ", romanization: "anchi", meaning: "you (to a female)", category: "Pronouns", chunks: [["a", "n", "chi"]] },
  { text: "እሱ", romanization: "isu", meaning: "he", category: "Pronouns", chunks: [["ie", "su"]] },
  { text: "እኛ", romanization: "egna", meaning: "we", category: "Pronouns", chunks: [["ie", "nya"]] },
  { text: "እነሱ", romanization: "inesu", meaning: "they", category: "Pronouns", chunks: [["ie", "ne", "su"]] },

  { text: "ምን", romanization: "min", meaning: "what", category: "Question words", chunks: [["m", "n"]] },
  { text: "ማን", romanization: "man", meaning: "who", category: "Question words", chunks: [["ma", "n"]] },
  { text: "የት", romanization: "yet", meaning: "where", category: "Question words", chunks: [["ye", "t"]] },
  { text: "መቼ", romanization: "meche", meaning: "when", category: "Question words", chunks: [["me", "chee"]] },
  { text: "ለምን", romanization: "lemin", meaning: "why", category: "Question words", chunks: [["le", "m", "n"]] },
  { text: "እንዴት", romanization: "indet", meaning: "how", category: "Question words", chunks: [["ie", "n", "dee", "t"]] },

  { text: "ውሃ", romanization: "wiha", meaning: "water", category: "Common nouns", chunks: [["w", "haa"]] },
  { text: "ቤት", romanization: "bet", meaning: "house", category: "Common nouns", chunks: [["bee", "t"]] },
  { text: "ምግብ", romanization: "migib", meaning: "food", category: "Common nouns", chunks: [["m", "g", "b"]] },
  { text: "መጽሐፍ", romanization: "metsihaf", meaning: "book", category: "Common nouns", chunks: [["me", "ts2", "he2", "f"]] },
  { text: "መኪና", romanization: "mekina", meaning: "car", category: "Common nouns", chunks: [["me", "ki", "na"]] },
  { text: "ፀሐይ", romanization: "tsehay", meaning: "sun", category: "Common nouns", chunks: [["tse", "he2", "y"]] },
  { text: "ጨረቃ", romanization: "cherek'a", meaning: "moon", category: "Common nouns", chunks: [["che'", "re", "qa"]] },
  { text: "ኮከብ", romanization: "kokeb", meaning: "star", category: "Common nouns", chunks: [["ko", "ke", "b"]] },
  { text: "ሰማይ", romanization: "semay", meaning: "sky", category: "Common nouns", chunks: [["se", "ma", "y"]] },
  { text: "ኢትዮጵያ", romanization: "ityop'iya", meaning: "Ethiopia", category: "Common nouns", chunks: [["i", "t", "yo", "p", "ya"]] },
  { text: "ቡና", romanization: "buna", meaning: "coffee", category: "Common nouns", chunks: [["bu", "na"]] },
  { text: "እንጀራ", romanization: "injera", meaning: "injera (Ethiopian staple food)", category: "Common nouns", chunks: [["ie", "n", "je", "ra"]] },
  { text: "ገንዘብ", romanization: "genzeb", meaning: "money", category: "Common nouns", chunks: [["ge", "n", "ze", "b"]] },
  { text: "ዘመን", romanization: "zemen", meaning: "time / era", category: "Common nouns", chunks: [["ze", "me", "n"]] },
  {
    text: "ትምህርት ቤት",
    romanization: "timihirt bet",
    meaning: "school",
    category: "Common nouns",
    chunks: [
      ["t", "m", "h", "r", "t"],
      ["bee", "t"],
    ],
  },

  // "green" (አረንጓዴ) is excluded -- needs a labialized glyph (ጓ) not yet recorded
  { text: "ቀይ", romanization: "qey", meaning: "red", category: "Colors", chunks: [["qe", "y"]] },
  { text: "ጥቁር", romanization: "t'ikur", meaning: "black", category: "Colors", chunks: [["t'", "ku", "r"]] },
  { text: "ነጭ", romanization: "nech", meaning: "white", category: "Colors", chunks: [["ne", "ch'"]] },
  { text: "ቢጫ", romanization: "bicha", meaning: "yellow", category: "Colors", chunks: [["bi", "cha'"]] },
  { text: "ሰማያዊ", romanization: "semayawi", meaning: "blue", category: "Colors", chunks: [["se", "ma", "ya", "wi"]] },
  { text: "ቡናማ", romanization: "bunama", meaning: "brown", category: "Colors", chunks: [["bu", "na", "ma"]] },

  { text: "ጥሩ", romanization: "t'iru", meaning: "good", category: "Adjectives", chunks: [["t'", "ru"]] },
  { text: "ትልቅ", romanization: "tilik'", meaning: "big", category: "Adjectives", chunks: [["t", "l", "q"]] },
  { text: "ትንሽ", romanization: "tinish", meaning: "small", category: "Adjectives", chunks: [["t", "n", "sh"]] },
  { text: "ቆንጆ", romanization: "konjo", meaning: "beautiful", category: "Adjectives", chunks: [["qo", "n", "jo"]] },
  { text: "አዲስ", romanization: "adis", meaning: "new", category: "Adjectives", chunks: [["a", "di", "s"]] },
  { text: "አሮጌ", romanization: "aroge", meaning: "old", category: "Adjectives", chunks: [["a", "ro", "gee"]] },

  // dictionary/3rd-person-past citation form, standard for Amharic
  { text: "ወደደ", romanization: "wedede", meaning: "to love / like", category: "Verbs", chunks: [["we", "de", "de"]] },
  { text: "በላ", romanization: "bela", meaning: "to eat", category: "Verbs", chunks: [["be", "la"]] },
  { text: "ሄደ", romanization: "hede", meaning: "to go", category: "Verbs", chunks: [["he", "de"]] },
  { text: "መጣ", romanization: "meta", meaning: "to come", category: "Verbs", chunks: [["me", "ta'"]] },
  { text: "አየ", romanization: "aye", meaning: "to see", category: "Verbs", chunks: [["a", "ye"]] },
  { text: "ጠጣ", romanization: "tet'a", meaning: "to drink", category: "Verbs", chunks: [["te'", "ta'"]] },
  { text: "ጻፈ", romanization: "tsafe", meaning: "to write", category: "Verbs", chunks: [["tsa2", "fe"]] },
  { text: "አነበበ", romanization: "anebebe", meaning: "to read", category: "Verbs", chunks: [["a", "ne", "be", "be"]] },

  { text: "ውሻ", romanization: "wisha", meaning: "dog", category: "Animals", chunks: [["w", "sha"]] },
  { text: "ድመት", romanization: "dimet", meaning: "cat", category: "Animals", chunks: [["d", "me", "t"]] },
  { text: "ላም", romanization: "lam", meaning: "cow", category: "Animals", chunks: [["la", "m"]] },
  { text: "ወፍ", romanization: "wef", meaning: "bird", category: "Animals", chunks: [["we", "f"]] },
  { text: "አሳ", romanization: "asa", meaning: "fish", category: "Animals", chunks: [["a", "sa"]] },
  { text: "አንበሳ", romanization: "anbesa", meaning: "lion", category: "Animals", chunks: [["a", "n", "be", "sa"]] },
  { text: "ፈረስ", romanization: "feres", meaning: "horse", category: "Animals", chunks: [["fe", "re", "s"]] },

  { text: "ራስ", romanization: "ras", meaning: "head", category: "Body parts", chunks: [["ra", "s"]] },
  { text: "አይን", romanization: "ayin", meaning: "eye", category: "Body parts", chunks: [["a", "y", "n"]] },
  { text: "እጅ", romanization: "ij", meaning: "hand", category: "Body parts", chunks: [["ie", "j"]] },
  { text: "እግር", romanization: "igir", meaning: "leg / foot", category: "Body parts", chunks: [["ie", "g", "r"]] },
  { text: "አፍ", romanization: "af", meaning: "mouth", category: "Body parts", chunks: [["a", "f"]] },
  { text: "ጆሮ", romanization: "joro", meaning: "ear", category: "Body parts", chunks: [["jo", "ro"]] },
  { text: "አፍንጫ", romanization: "afincha", meaning: "nose", category: "Body parts", chunks: [["a", "f", "n", "cha'"]] },

  { text: "ዛሬ", romanization: "zare", meaning: "today", category: "Time", chunks: [["za", "re"]] },
  { text: "ነገ", romanization: "nege", meaning: "tomorrow", category: "Time", chunks: [["ne", "ge"]] },
  { text: "አሁን", romanization: "ahun", meaning: "now", category: "Time", chunks: [["a", "hu", "n"]] },
  { text: "ትናንት", romanization: "tinant", meaning: "yesterday", category: "Time", chunks: [["t", "na", "n", "t"]] },
];

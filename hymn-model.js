// Pure hymn indexing and search. The browser UI and the tests both use this.

const SECTION_ORDER = [
  "Advent",
  "Christmas",
  "Lent",
  "Holy Week",
  "Easter",
  "Ascension",
  "Pentecost",
  "Thanksgiving",
];

const ARTICLES = new Set(["a", "an", "the"]);
const JUNK_CREDIT = /^(mod\.?|alt\.?|altered|modernized)$/i;
const NON_PERSON =
  /\b(anonymous|traditional|carols?|liturg(?:y|ies)|antiphons?|hymns?|spirituals?|folk|medieval|psalms?|books?|sources?|unknown|various|melod(?:y|ies)|centur(?:y|ies))\b/i;
const PARTICLE = /^(von|van|de|del|della|di|da|du|la|le|st\.?|saint)$/i;
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv)$/i;

// The 1990 Trinity Hymnal runs to 742. A song that is not in the hymnal is
// filed under a higher number. That number is only its place in the list and
// its address. It is never shown or searched as a hymnal number.
export const HYMNAL_LAST = 742;

export function inHymnal(hymn) {
  const number = hymn ? hymn.number : null;
  return Number.isInteger(number) && number >= 1 && number <= HYMNAL_LAST;
}

// The hymnal number as text, or an empty string for a song with none.
export function numberLabel(hymn) {
  return inHymnal(hymn) ? String(hymn.number) : "";
}

// "642. Be Thou My Vision", or the bare title for a song with no number.
export function numberedTitle(hymn, separator = ". ") {
  if (!hymn) return "";
  return inHymnal(hymn) ? `${hymn.number}${separator}${hymn.title}` : String(hymn.title);
}

export function sortByNumber(hymns) {
  return [...hymns].sort((a, b) => a.number - b.number);
}

export function listSections(hymns) {
  const seen = [];
  for (const hymn of sortByNumber(hymns)) {
    if (hymn.section && !seen.includes(hymn.section)) seen.push(hymn.section);
  }
  const preferred = SECTION_ORDER.filter((name) => seen.includes(name));
  const rest = seen.filter((name) => !SECTION_ORDER.includes(name));
  return [...preferred, ...rest];
}

export function foldText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function stripLeadingArticle(value) {
  const parts = String(value || "").trim().split(/\s+/);
  if (parts.length > 1 && ARTICLES.has(parts[0].toLowerCase().replace(/[^a-z]/g, ""))) {
    return parts.slice(1).join(" ");
  }
  return parts.join(" ");
}

export function titleSortKey(title) {
  return foldText(stripLeadingArticle(title));
}

export function titleLetter(title) {
  const key = titleSortKey(title);
  const match = key.match(/[a-z]/);
  return match ? match[0].toUpperCase() : "#";
}

function hymnSearchText(hymn) {
  const parts = [
    hymn.title,
    hymn.author,
    hymn.translator,
    hymn.tune,
    hymn.composer,
    numberLabel(hymn),
  ];
  for (const stanza of hymn.stanzas || []) parts.push(stanza.join(" "));
  if (hymn.refrain) parts.push(hymn.refrain.join(" "));
  return foldText(parts.filter(Boolean).join(" "));
}

export function hymnMatches(hymn, query) {
  const q = foldText(query);
  if (!q) return true;
  const number = numberLabel(hymn);
  if (number && /^\d+$/.test(q) && (number === q || number.startsWith(q))) return true;
  return hymnSearchText(hymn).includes(q);
}

export function filterHymns(hymns, query, section) {
  const name = section && section !== "all" ? section : null;
  return sortByNumber(
    hymns.filter((hymn) => {
      if (name && hymn.section !== name) return false;
      return hymnMatches(hymn, query);
    }),
  );
}

export function titleIndex(hymns) {
  const sorted = [...hymns].sort((a, b) => {
    const ka = titleSortKey(a.title);
    const kb = titleSortKey(b.title);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a.number - b.number;
  });
  const letters = [];
  for (const hymn of sorted) {
    const letter = titleLetter(hymn.title);
    let bucket = letters[letters.length - 1];
    if (!bucket || bucket.letter !== letter) {
      bucket = { letter, hymns: [] };
      letters.push(bucket);
    }
    bucket.hymns.push(hymn);
  }
  return letters;
}

function cleanCredit(raw) {
  let text = String(raw || "").trim();
  if (!text || JUNK_CREDIT.test(text)) return null;
  let para = false;
  text = text
    .replace(/\s*\(([^)]*)\)/g, (_, inner) => {
      if (/para/i.test(inner)) para = true;
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/,\s*\d+(st|nd|rd|th)\s+cent\.?$/i, "");
  text = text.replace(/,\s*ca\.?\s*\d{3,4}$/i, "");
  text = text.replace(/,\s*\d{3,4}\s*-\s*\d{2,4}$/i, "");
  text = text.replace(/,\s*\d{3,4}$/i, "");
  text = text.trim();
  if (!text || JUNK_CREDIT.test(text)) return null;
  return { text, para };
}

function invertName(name) {
  if (NON_PERSON.test(name)) return name;
  const parts = name.split(/\s+/);
  if (parts.length < 2) return name;
  let suffix = "";
  if (parts.length > 2 && SUFFIX.test(parts[parts.length - 1])) {
    suffix = parts.pop();
  }
  const surname = [parts.pop()];
  while (parts.length > 1 && PARTICLE.test(parts[parts.length - 1])) {
    surname.unshift(parts.pop());
  }
  const given = parts.join(" ");
  const last = suffix ? `${surname.join(" ")} ${suffix}` : surname.join(" ");
  return given ? `${last}, ${given}` : last;
}

function parseCreditList(value) {
  if (!value) return [];
  const credits = [];
  for (const piece of String(value).split(/\s*;\s*/)) {
    const cleaned = cleanCredit(piece);
    if (!cleaned) continue;
    const base = invertName(cleaned.text);
    credits.push({
      base,
      key: foldText(base),
      sort: foldText(stripLeadingArticle(base)),
      para: cleaned.para,
    });
  }
  return credits;
}

function addCredits(map, hymn, value, role) {
  for (const credit of parseCreditList(value)) {
    let group = map.get(credit.key);
    if (!group) {
      group = {
        base: credit.base,
        sort: credit.sort,
        byNumber: new Map(),
      };
      map.set(credit.key, group);
    }
    const prev = group.byNumber.get(hymn.number);
    if (!prev) {
      group.byNumber.set(hymn.number, { hymn, role, para: credit.para });
    } else if (prev.role === "translator" && role === "author") {
      group.byNumber.set(hymn.number, { hymn, role: "author", para: false });
    } else if (role === "translator" && credit.para) {
      prev.para = true;
    }
  }
}

export function authorIndex(hymns) {
  const map = new Map();
  for (const hymn of sortByNumber(hymns)) {
    addCredits(map, hymn, hymn.author, "author");
    addCredits(map, hymn, hymn.translator, "translator");
  }
  const groups = [...map.values()].map((group) => {
    const items = [...group.byNumber.values()].sort((a, b) => a.hymn.number - b.hymn.number);
    const hasAuthor = items.some((item) => item.role === "author");
    const translations = items.filter((item) => item.role === "translator");
    const paraOnly =
      !hasAuthor && translations.length > 0 && translations.every((item) => item.para);
    const label = hasAuthor ? group.base : `${group.base} (${paraOnly ? "para." : "tr."})`;
    return {
      label,
      sort: group.sort,
      hymns: items.map((item) => ({
        hymn: item.hymn,
        mark: hasAuthor && item.role === "translator" ? "tr." : null,
      })),
    };
  });
  groups.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  const letters = [];
  for (const group of groups) {
    const letterMatch = group.sort.match(/[a-z]/);
    const letter = letterMatch ? letterMatch[0].toUpperCase() : "#";
    let bucket = letters[letters.length - 1];
    if (!bucket || bucket.letter !== letter) {
      bucket = { letter, groups: [] };
      letters.push(bucket);
    }
    bucket.groups.push(group);
  }
  return letters;
}

export function browse(hymns, options = {}) {
  const mode = options.mode || "number";
  const filtered = filterHymns(hymns, options.query || "", options.section || "all");
  if (mode === "title") {
    return { mode, total: filtered.length, letters: titleIndex(filtered) };
  }
  if (mode === "author") {
    return { mode, total: filtered.length, letters: authorIndex(filtered) };
  }
  return { mode: "number", total: filtered.length, hymns: filtered };
}

export function isWithheld(hymn) {
  return hymn.public_domain === false;
}

// A hymn that is in the index by number and title with no words sourced yet.
// This is not isWithheld: nothing is being kept back for copyright, and no
// claim is made either way. The text simply has not been added.
export function wordsPending(hymn) {
  if (!hymn || hymn.public_domain === false) return false;
  const stanzas = Array.isArray(hymn.stanzas) ? hymn.stanzas : [];
  return stanzas.length === 0;
}

export function partialNote(hymn) {
  if (!hymn || !hymn.copyright_note || hymn.public_domain === false) return null;
  return String(hymn.copyright_note).replace(/^PARTIAL\.\s*/, "");
}

export function gapNote(missing) {
  if (!missing || missing.length === 0) return "";
  if (missing.length === 1) return `Stanza ${missing[0]} is omitted.`;
  if (missing.length === 2) return `Stanzas ${missing[0]} and ${missing[1]} are omitted.`;
  const head = missing.slice(0, -1).join(", ");
  return `Stanzas ${head}, and ${missing[missing.length - 1]} are omitted.`;
}

export function copyrightStanzaNote(item) {
  const who = [item.holder, item.year].filter(Boolean).join(", ");
  return `Stanza ${item.number}. Words are under copyright and are not reproduced here. ${who}.`;
}

export function stanzaPlan(hymn) {
  const stanzas = Array.isArray(hymn.stanzas) ? hymn.stanzas : [];
  const numbers =
    Array.isArray(hymn.stanza_numbers) && hymn.stanza_numbers.length === stanzas.length
      ? hymn.stanza_numbers
      : stanzas.map((_, index) => index + 1);
  const refrain = Array.isArray(hymn.refrain) && hymn.refrain.length > 0 ? hymn.refrain : null;
  const afterEach = Boolean(refrain && hymn.refrain_after_each_stanza);
  const blocks = [];
  stanzas.forEach((lines, index) => {
    if (index > 0) {
      const claims = new Map(
        (Array.isArray(hymn.copyright_stanzas) ? hymn.copyright_stanzas : []).map((item) => [item.number, item]),
      );
      const plain = [];
      const flush = () => {
        const note = gapNote(plain.splice(0, plain.length));
        if (note) blocks.push({ type: "gap", note });
      };
      for (let n = numbers[index - 1] + 1; n < numbers[index]; n += 1) {
        const claim = claims.get(n);
        if (!claim) {
          plain.push(n);
          continue;
        }
        flush();
        blocks.push({ type: "copyright", number: n, note: copyrightStanzaNote({ ...claim, number: n }) });
      }
      flush();
    }
    blocks.push({ type: "stanza", number: numbers[index], lines });
    if (afterEach) blocks.push({ type: "refrain", lines: refrain });
  });
  if (refrain && !afterEach) blocks.push({ type: "refrain", lines: refrain });
  return blocks;
}

// Other tunes Faith sings these words to, from `alt_tunes` in the hymn data.
export function altTunes(hymn) {
  const list = hymn && Array.isArray(hymn.alt_tunes) ? hymn.alt_tunes : [];
  return list.filter((item) => item && typeof item.tune === "string" && item.tune.trim());
}

export function attributionParts(hymn) {
  const people = [];
  if (hymn.author) people.push(hymn.author);
  if (hymn.translator) people.push(`tr. ${hymn.translator}`);
  const music = [];
  const others = altTunes(hymn);
  // With a second tune on the page, each tune names the book that sets it.
  if (hymn.tune) {
    music.push(others.length && hymn.tune_book ? `${hymn.tune} (${hymn.tune_book})` : hymn.tune);
  }
  if (hymn.composer) music.push(hymn.composer);
  for (const other of others) {
    music.push(other.book ? `also sung to ${other.tune} (${other.book})` : `also sung to ${other.tune}`);
  }
  return {
    people: people.join(" · "),
    music: music.join(" · "),
  };
}

export function neighbors(hymns, number) {
  const sorted = sortByNumber(hymns);
  const index = sorted.findIndex((hymn) => hymn.number === number);
  if (index < 0) return { hymn: null, prev: null, next: null };
  return {
    hymn: sorted[index],
    prev: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}

const OTHER_TUNE = { 204: 205, 205: 204, 222: 223, 223: 222 };
// Hymns Faith has sung to a tune other than the one in the 1990 Trinity Hymnal.
// The recordings name their own tune (`tune` in recordings.json).
const TUNE_NOTE = {
  99: "Faith sings these words to two melodies (tunes): WINCHESTER NEW, from today's Trinity Hymnal, and MARYTON, from the 1961 (blue) Trinity Hymnal. The recordings are at the top of this page, grouped by melody.",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function youtubeId(value) {
  if (!value) return null;
  const id = String(value).split(/[?&#/]/)[0];
  return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
}

function parseTimestamp(value) {
  const text = String(value || "").trim();
  if (/^\d+s?$/.test(text)) return Number(text.replace(/s$/, ""));
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!match || (match[1] == null && match[2] == null && match[3] == null)) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export function recordingStart(recording) {
  if (!recording || typeof recording !== "object") return null;
  const raw = recording.start_seconds;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())) return Math.floor(Number(raw));
  if (typeof recording.url !== "string") return null;
  try {
    const parsed = new URL(recording.url.trim(), "https://hark.local/");
    const stamp = parsed.searchParams.get("t") || parsed.searchParams.get("start");
    const seconds = parseTimestamp(stamp);
    return seconds == null ? null : seconds;
  } catch {
    return null;
  }
}

export function youtubeEmbedSrc(id, start) {
  const base = `https://www.youtube-nocookie.com/embed/${id}`;
  if (start == null) return base;
  return `${base}?start=${start}`;
}

// A plain YouTube watch link at a second. On Android it opens in the YouTube app.
export function youtubeWatchUrl(id, seconds) {
  const clean = youtubeId(id);
  if (!clean) return "";
  const t = Math.max(0, Math.floor(Number(seconds) || 0));
  return `https://www.youtube.com/watch?v=${clean}${t > 0 ? `&t=${t}s` : ""}`;
}

export function formatRecordingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function tuneCaution(number) {
  const note = TUNE_NOTE[Number(number)];
  if (note) return note;
  const other = OTHER_TUNE[Number(number)];
  if (!other) return "";
  return `The tune sung may differ. The hymnal also sets these words to another tune (no. ${other}).`;
}

// The line shown on a recording: its label, then the tune when the recording
// names one. A recording with no known tune shows the label alone.
export function recordingCaption(item) {
  if (!item) return "";
  const label = item.label || "";
  if (typeof item.tune !== "string" || !item.tune.trim()) return label;
  return label ? `${label}, tune ${item.tune.trim()}` : `Tune ${item.tune.trim()}`;
}

function tuneOf(item) {
  return item && typeof item.tune === "string" ? item.tune.trim() : "";
}

// "1990 Trinity Hymnal" is the book in the pew, so it reads as today's.
// The 1961 book is known by its blue cover.
function bookInWords(book) {
  const name = typeof book === "string" ? book.trim() : "";
  if (name === "1990 Trinity Hymnal") return "today's Trinity Hymnal";
  if (name === "1961 Trinity Hymnal") return "the 1961 blue Trinity Hymnal";
  return name ? `the ${name.replace(/^the\s+/i, "")}` : "";
}

function countRecordings(count) {
  return count === 1 ? "1 recording" : `${count} recordings`;
}

// One group per melody when the recordings of a hymn name more than one tune.
// `items` is the list from faithRecordings, newest first. The hymnal's own
// tune comes first, then the others in the order of `alt_tunes`. A hymn whose
// recordings name one tune, or none, has no groups: the list is plain.
// Each group carries its number (1, 2, ...), which picks its color.
export function melodyGroups(hymn, items) {
  const list = Array.isArray(items) ? items : [];
  const sung = [];
  for (const item of list) {
    const tune = tuneOf(item);
    if (tune && !sung.includes(tune)) sung.push(tune);
  }
  if (!hymn || sung.length < 2) return [];
  const own = typeof hymn.tune === "string" ? hymn.tune.trim() : "";
  const others = altTunes(hymn);
  const order = [own, ...others.map((item) => item.tune.trim())].filter((tune) => sung.includes(tune));
  for (const tune of sung) if (!order.includes(tune)) order.push(tune);
  const groups = order.map((tune, at) => {
    const mine = list.filter((item) => tuneOf(item) === tune);
    const hymnal = tune === own;
    const other = others.find((item) => item.tune.trim() === tune);
    const book = bookInWords(hymnal ? hymn.tune_book : other && other.book);
    const where = hymnal
      ? book ? `the melody in ${book}` : "the hymnal melody"
      : book ? `from ${book}` : "a different melody";
    const total = countRecordings(mine.length);
    const newest = mine[0] && mine[0].date;
    let description;
    if (hymnal) {
      description = `This is the tune printed with these words in ${book || "the hymnal"}. ${total}.`;
    } else {
      const when = mine.length === 1 && newest ? `Faith sang it on ${newest}` : `Faith has sung it ${mine.length} times`;
      description = `A different tune for the same words. ${when}. ${total}.`;
    }
    return {
      index: at + 1,
      tune,
      hymnal,
      heading: `Melody ${at + 1}: ${tune} (${where})`,
      description,
      items: mine,
    };
  });
  const unnamed = list.filter((item) => !tuneOf(item));
  if (unnamed.length) {
    groups.push({
      index: groups.length + 1,
      tune: "",
      hymnal: false,
      heading: "Melody not noted",
      description: `Hark has not noted which melody these use. ${countRecordings(unnamed.length)}.`,
      items: unnamed,
    });
  }
  return groups;
}

// The melody of one recording: its tune, and its group number when the hymn
// is sung to more than one. Null when the recording names no tune.
export function melodyOf(hymn, items, item) {
  const tune = tuneOf(item);
  if (!tune) return null;
  const group = melodyGroups(hymn, items).find((entry) => entry.tune === tune);
  return { tune, index: group ? group.index : 0 };
}

// What the player shows while a recording plays.
export function melodyLabel(tune) {
  const name = typeof tune === "string" ? tune.trim() : "";
  return name ? `Melody: ${name}` : "";
}

// The recordings in the order the play buttons should try them. With more
// than one melody the hymnal's own comes first, newest first within it.
// Otherwise the order is unchanged: newest first.
export function playOrder(hymn, items) {
  const list = Array.isArray(items) ? items : [];
  const groups = melodyGroups(hymn, list);
  if (!groups.length || !groups[0].hymnal) return list;
  return groups.flatMap((group) => group.items);
}

// The line under Play song on a hymn sung to more than one melody. It says
// which melody the button plays. The melodies themselves are right under it.
export function playSongCaption(hymn, items, playing) {
  const groups = melodyGroups(hymn, items);
  const tune = tuneOf(playing);
  const mine = groups.find((group) => group.tune && group.tune === tune);
  if (!mine) return "";
  return mine.hymnal
    ? `Play song plays the hymnal melody, ${mine.tune}.`
    : `Play song plays the melody ${mine.tune}.`;
}

// The line in the Music block that says which melody the score is, when the
// recordings use more than one. Empty when there is nothing to tell apart.
export function scoreMelodyNote(hymn, items, scoreTune) {
  const groups = melodyGroups(hymn, items);
  const tune = typeof scoreTune === "string" ? scoreTune.trim() : "";
  const shown = groups.find((group) => group.tune && group.tune === tune);
  if (!shown) return "";
  const rest = groups.filter((group) => group !== shown && group.tune);
  const first = shown.hymnal
    ? `The music shown here is ${shown.tune}, the hymnal melody (Melody ${shown.index}).`
    : `The music shown here is ${shown.tune} (Melody ${shown.index}).`;
  if (!rest.length) return first;
  const names = rest.map((group) => `${group.tune} (Melody ${group.index})`).join(" or ");
  return `${first} It is not the music for ${names}.`;
}

function presentRecording(recording, fallbackLabel) {
  if (!recording || typeof recording !== "object") return null;
  const media = classifyRecording(recording.url);
  if (!media) return null;
  const label =
    typeof recording.label === "string" && recording.label.trim()
      ? recording.label.trim()
      : fallbackLabel;
  const start = media.kind === "youtube" ? recordingStart(recording) : null;
  const url = typeof recording.url === "string" ? recording.url.trim() : "";
  const item = {
    label,
    date: formatRecordingDate(recording.video_date),
    dateSort: typeof recording.video_date === "string" ? recording.video_date : "",
    url,
    start,
    ...media,
    embed: media.kind === "youtube" ? youtubeEmbedSrc(media.id, start) : null,
  };
  if (typeof recording.tune === "string" && recording.tune.trim()) item.tune = recording.tune.trim();
  if (typeof recording.end_seconds === "number" && Number.isFinite(recording.end_seconds)) {
    item.end = Math.floor(recording.end_seconds);
  }
  if (recording.end_source === "captions" || recording.end_source === "audio") {
    item.endSource = recording.end_source;
  }
  if (recording.embeddable === false) item.embeddable = false;
  return item;
}

export function youtubeBlock(item) {
  if (!item) return null;
  const youtube = item.kind === "youtube" || item.youtube === true;
  if (!youtube) return null;
  if (item.embeddable === false) {
    const id = typeof item.id === "string" ? item.id : "";
    return {
      type: "card",
      href: item.url,
      thumb: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "",
      label: "Watch on YouTube",
    };
  }
  if (!item.embed) return null;
  return { type: "iframe", src: item.embed };
}

export function classifyRecording(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed, "https://hark.local/");
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = youtubeId(parsed.pathname.replace(/^\//, ""));
    return id ? { kind: "youtube", id } : null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    let id = youtubeId(parsed.searchParams.get("v"));
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!id && ["embed", "shorts", "live", "v"].includes(parts[0])) id = youtubeId(parts[1]);
    return id ? { kind: "youtube", id } : null;
  }
  const path = parsed.pathname.toLowerCase();
  if (/\.(mp4|webm|ogv)$/.test(path)) return { kind: "video", url: trimmed };
  return { kind: "audio", url: trimmed };
}

export function listRecordings(hymn) {
  if (!hymn || !Array.isArray(hymn.recordings)) return [];
  const items = [];
  for (const recording of hymn.recordings) {
    const item = presentRecording(recording, "Choir recording");
    if (item) items.push(item);
  }
  return items;
}

export function themesForHymn(catalog, number) {
  if (!catalog || !catalog.hymns) return [];
  const entry = catalog.hymns[String(number)];
  if (!entry) return [];
  const seasons = catalog.seasons || [];
  const topics = catalog.topics || [];
  const pick = (defs, ids) =>
    (ids || []).map((id) => defs.find((item) => item.id === id)).filter(Boolean);
  return [...pick(seasons, entry.seasons), ...pick(topics, entry.topics)];
}

export function findTheme(catalog, id) {
  if (!catalog) return null;
  return [...(catalog.seasons || []), ...(catalog.topics || [])].find((item) => item.id === id) || null;
}

export function hymnsInTheme(catalog, id) {
  if (!catalog || !catalog.hymns) return [];
  const numbers = [];
  for (const [key, entry] of Object.entries(catalog.hymns)) {
    const tags = [...(entry.seasons || []), ...(entry.topics || [])];
    if (tags.includes(id)) numbers.push(Number(key));
  }
  return numbers.sort((a, b) => a - b);
}

export function themeOutline(catalog, hymns, options = {}) {
  const visible = new Set(filterHymns(hymns, options.query || "", options.section || "all").map((hymn) => hymn.number));
  const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));
  const build = (defs) =>
    (defs || [])
      .map((def) => ({
        ...def,
        hymns: hymnsInTheme(catalog, def.id)
          .filter((number) => visible.has(number))
          .map((number) => byNumber.get(number))
          .filter(Boolean),
      }))
      .filter((group) => group.hymns.length > 0);
  return {
    seasons: build(catalog && catalog.seasons),
    topics: build(catalog && catalog.topics),
  };
}

export function faithRecordings(catalog, number) {
  if (!catalog || typeof catalog !== "object") return [];
  const raw = catalog[String(number)];
  if (!Array.isArray(raw)) return [];
  const items = [];
  raw.forEach((entry, index) => {
    const item = presentRecording(entry, "Worship recording");
    if (item) items.push({ ...item, index });
  });
  items.sort((a, b) => {
    if (a.dateSort !== b.dateSort) return a.dateSort < b.dateSort ? 1 : -1;
    if ((a.start || 0) !== (b.start || 0)) return (b.start || 0) - (a.start || 0);
    return a.index - b.index;
  });
  return items;
}

export function listSermons(catalog, key) {
  if (!catalog || typeof catalog !== "object") return [];
  const grouped = catalog.groups && catalog.groups[key];
  const raw = key === "page"
    ? catalog.page
    : Array.isArray(grouped)
      ? grouped
      : catalog[key];
  if (!Array.isArray(raw)) return [];
  const items = [];
  raw.forEach((entry) => {
    const item = presentSermon(entry);
    if (item) items.push(item);
  });
  return items;
}

function presentSermon(entry) {
  if (!entry || typeof entry !== "object") return null;
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  const url = typeof entry.url === "string" ? entry.url.trim() : "";
  if (!title || !url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const media = classifyRecording(url);
  const youtube = Boolean(media && media.kind === "youtube");
  const start = recordingStart(entry);
  if (youtube && start != null && !parsed.searchParams.has("t") && !parsed.searchParams.has("start")) {
    parsed.searchParams.set("t", `${start}s`);
  }
  const item = {
    title,
    preacher: typeof entry.preacher === "string" ? entry.preacher.trim() : "",
    text: typeof entry.text === "string" ? entry.text.trim() : "",
    date: formatRecordingDate(entry.date),
    dateSort: typeof entry.date === "string" ? entry.date : "",
    url: parsed.toString(),
    youtube,
    id: youtube ? media.id : "",
    start,
    embed: youtube ? youtubeEmbedSrc(media.id, start) : null,
  };
  if (entry.embeddable === false) item.embeddable = false;
  return item;
}

const BULLETIN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// A Faith Presbyterian bulletin PDF on the church file host. Other sources,
// including hymnary.org, are not a church bulletin.
const BULLETIN_URL =
  /^https:\/\/faithtacoma\.sfo2\.cdn\.digitaloceanspaces\.com\/\d{4}\/\d{2}\/(\d{1,2})\.(\d{1,2})\.(\d{2})Bulletin-(am|pm)-6x9-1\.pdf$/;

export function faithBulletin(hymn) {
  const url = hymn && typeof hymn.source_url === "string" ? hymn.source_url : "";
  const match = BULLETIN_URL.exec(url);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = 2000 + Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const service = match[4] === "am" ? "morning" : "evening";
  return {
    url,
    label: `Faith Presbyterian bulletin, ${BULLETIN_MONTHS[month - 1]} ${day}, ${year}, ${service}`,
  };
}

// What the hymn page shows for a bulletin: the text link, and a picture of
// the bulletin page when one was made. `images` is data/bulletins.json, which
// scripts/build-bulletin-images.py writes. A phone browser cannot show a PDF
// inside a page, so the picture stands in for it and links to the PDF. With
// no picture, or one made from another PDF, image is null and only the text
// link shows.
export function bulletinBlock(hymn, images) {
  const bulletin = faithBulletin(hymn);
  if (!bulletin) return null;
  const entry = images && typeof images === "object" ? images[String(hymn.number)] : null;
  let image = null;
  if (
    entry &&
    typeof entry === "object" &&
    entry.pdf === bulletin.url &&
    typeof entry.src === "string" &&
    /^bulletins\/\d+\.(?:webp|jpg)$/.test(entry.src) &&
    Number.isInteger(entry.width) &&
    Number.isInteger(entry.height) &&
    entry.width > 0 &&
    entry.height > 0
  ) {
    image = { src: entry.src, width: entry.width, height: entry.height, alt: bulletin.label };
  }
  return { url: bulletin.url, label: bulletin.label, image };
}

// The lines on a hymn page that name where the song comes from. Only a hymn
// that is in the Trinity Hymnal may name the hymnal. Any other song names the
// bulletin it was taken from, or says nothing when there is none. An empty
// string means the line is left out.
export function sourceWording(hymn) {
  if (inHymnal(hymn)) {
    return {
      music: "See the printed Trinity Hymnal for the music.",
      words: "See the printed Trinity Hymnal for the words.",
      setting: "May differ from the Trinity Hymnal setting.",
      colophon: "Trinity Hymnal, 1990",
    };
  }
  const bulletin = faithBulletin(hymn);
  return {
    music: bulletin ? "See the bulletin for the music." : "",
    words: bulletin ? "See the bulletin for the words." : "",
    setting: "",
    colophon: bulletin ? bulletin.label : "",
  };
}

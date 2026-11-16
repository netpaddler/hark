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
    String(hymn.number),
  ];
  for (const stanza of hymn.stanzas || []) parts.push(stanza.join(" "));
  if (hymn.refrain) parts.push(hymn.refrain.join(" "));
  return foldText(parts.filter(Boolean).join(" "));
}

export function hymnMatches(hymn, query) {
  const q = foldText(query);
  if (!q) return true;
  const number = String(hymn.number);
  if (/^\d+$/.test(q) && (number === q || number.startsWith(q))) return true;
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
      const missing = [];
      for (let n = numbers[index - 1] + 1; n < numbers[index]; n += 1) missing.push(n);
      const note = gapNote(missing);
      if (note) blocks.push({ type: "gap", note });
    }
    blocks.push({ type: "stanza", number: numbers[index], lines });
    if (afterEach) blocks.push({ type: "refrain", lines: refrain });
  });
  if (refrain && !afterEach) blocks.push({ type: "refrain", lines: refrain });
  return blocks;
}

export function attributionParts(hymn) {
  const people = [];
  if (hymn.author) people.push(hymn.author);
  if (hymn.translator) people.push(`tr. ${hymn.translator}`);
  const music = [];
  if (hymn.tune) music.push(hymn.tune);
  if (hymn.composer) music.push(hymn.composer);
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

export function formatRecordingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function tuneCaution(number) {
  const other = OTHER_TUNE[Number(number)];
  if (!other) return "";
  return `The tune sung may differ. The hymnal also sets these words to another tune (no. ${other}).`;
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

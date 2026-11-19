// What the welcome page says and which hymns it shows. Pure, so the tests can
// hold every number and every featured hymn against the data files.

import {
  faithRecordings,
  findTheme,
  hymnsInTheme,
  inHymnal,
  isWithheld,
  listRecordings,
  sortByNumber,
  wordsPending,
} from "./hymn-model.js";

export const RETURNING_KEY = "hark-returning";
export const NEWCOMER_KEY = "hark-newcomer";

const MONTH_NAMES = [
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
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86400000;

// Shown ahead of a season only when it is this close.
const UPCOMING_DAYS = 28;

export const welcomeCopy = {
  documentTitle: "Welcome · Hark",
  title: "Timeless songs of grace, ready to sing.",
  lead:
    "Hark is a songbook for your phone. Read timeless songs of grace, and hear them sung in worship at Faith Presbyterian Church in Tacoma.",
  actions: {
    browse: "Browse the songs",
    seasons: "Browse by season",
    install: "Install Hark",
    request: "Request a song",
  },
  search: {
    label: "Go to a song by number, title, or a line",
    placeholder: "Number, title, or a line",
    button: "Find",
  },
  stats: {
    heading: "Hark in numbers",
    words: ["song with its words", "songs with their words"],
    pending: ["more listed by number and title", "more listed by number and title"],
    recordings: ["recording from worship", "recordings from worship"],
    scores: ["tune with music to play", "tunes with music to play"],
  },
  publicDomain: {
    claim: "Every hymn text in Hark is in the public domain.",
    detail:
      "Where a hymn has a newer stanza still under copyright, only its public domain stanzas are shown.",
  },
  today: {
    kicker: "A song for today",
    link: "Read the song",
  },
  featured: {
    seasonKicker: "This season",
    seasonHeading: (title) => `Songs for ${title}`,
    yearKicker: "For any Sunday",
    yearHeading: "Songs for the whole year",
    plainKicker: "To begin",
    plainHeading: "Songs to begin with",
    seasonLink: (title) => `All ${title} songs`,
    yearLink: (title) => `${title} songs`,
    upcoming: (title, when) => `${title} begins ${when}.`,
    upcomingLink: (title) => `See the ${title} songs`,
  },
  features: {
    heading: "What you will find",
    items: [
      {
        id: "words",
        icon: "search",
        title: "The words, easy to read",
        text:
          "Large type, with stanzas numbered as they are in the songbook. Search by number, title, author, tune, or any line you remember.",
        link: "Browse the songs",
        href: "#/",
      },
      {
        id: "hear",
        icon: "play",
        title: "Hear it at Faith Presbyterian",
        text:
          "Recordings from worship at Faith Presbyterian Church, Tacoma. Each one opens at the hymn.",
        link: (hymn) => (inHymnal(hymn) ? `Hear no. ${hymn.number}` : `Hear ${hymn.title}`),
      },
      {
        id: "music",
        icon: "note",
        title: "Music to read and play",
        text:
          "Where a public domain score is on file, open the music and play the tune at the tempo you choose.",
        link: (hymn) =>
          inHymnal(hymn) ? `See the music for no. ${hymn.number}` : `See the music for ${hymn.title}`,
      },
      {
        id: "themes",
        icon: "star",
        title: "Seasons and themes",
        text: "Songs gathered by the season of the year and by what they teach.",
        link: "Browse the themes",
        href: "#/themes",
      },
      {
        id: "sins",
        icon: "book",
        title: "Sin, repentance, and the gospel",
        text:
          "The Sins page begins with the Westminster Shorter Catechism on what sin is, reads the Ten Commandments and other Scripture, and ends with repentance and the gospel.",
        link: "Open the Sins page",
        href: "#/sins",
      },
      {
        id: "offline",
        icon: "phone",
        title: "Offline, on your home screen",
        text:
          "After your first visit the words stay on your device. Install Hark and it opens like an app. Recordings still need a connection.",
        link: "How to install",
        href: "#/install",
      },
    ],
  },
  seasons: {
    heading: "Browse by season",
    all: "All themes",
  },
  request: {
    heading: "Is a song missing?",
    text: "Leave a comment or request any song. No account is needed, and we read every one.",
    button: "Request a song",
  },
  about:
    "Hark was made for the people of Faith Presbyterian Church in Tacoma, and it is open to anyone who loves these songs.",
  privacy:
    "Hark uses cookies, Google Analytics, and Cloudflare Web Analytics to understand how people use it. It honors Global Privacy Control: if your browser sends that signal, Hark does not use Google Analytics or count your listening.",
};

// A hymn whose words Hark actually shows.
export function hasWords(hymn) {
  return Boolean(hymn) && !isWithheld(hymn) && !wordsPending(hymn);
}

// A hymn the welcome page may put forward: its words are shown, and shown
// whole. A hymn with stanzas left out for copyright stays in the lists, but it
// is not what a first visit should meet, and its credit line names the author
// of the stanzas that are not here.
export function canFeature(hymn) {
  return hasWords(hymn) && !hymn.copyright_note;
}

// The welcome page says every hymn text is in the public domain. It only says
// so while the data agrees: any hymn that carries words must be marked so.
export function everyTextPublicDomain(hymns) {
  if (!Array.isArray(hymns)) return false;
  const withText = hymns.filter((hymn) => Array.isArray(hymn.stanzas) && hymn.stanzas.length > 0);
  return withText.length > 0 && withText.every((hymn) => hymn.public_domain === true);
}

function hasScore(music, hymn) {
  return Boolean(music && music.scores && music.scores[String(hymn.number)]);
}

function recordingCount(recordings, hymn) {
  return faithRecordings(recordings, hymn.number).length + listRecordings(hymn).length;
}

// Counted from the data each time, never written down. Hymns whose words are
// withheld are left out of every figure.
export function welcomeStats({ hymns, recordings, music }) {
  const listed = (Array.isArray(hymns) ? hymns : []).filter((hymn) => !isWithheld(hymn));
  let words = 0;
  let pending = 0;
  let recorded = 0;
  let recordingTotal = 0;
  let scores = 0;
  for (const hymn of listed) {
    if (hasWords(hymn)) words += 1;
    else pending += 1;
    const heard = recordingCount(recordings, hymn);
    if (heard > 0) recorded += 1;
    recordingTotal += heard;
    if (hasScore(music, hymn)) scores += 1;
  }
  return { words, pending, recorded, recordings: recordingTotal, scores };
}

function plural(count, [one, many]) {
  return count === 1 ? one : many;
}

// The figures as the page shows them. A zero is dropped rather than shown.
export function statItems(stats, copy = welcomeCopy.stats) {
  return [
    { id: "words", value: stats.words, label: plural(stats.words, copy.words) },
    { id: "pending", value: stats.pending, label: plural(stats.pending, copy.pending) },
    { id: "recordings", value: stats.recordings, label: plural(stats.recordings, copy.recordings) },
    { id: "scores", value: stats.scores, label: plural(stats.scores, copy.scores) },
  ].filter((item) => item.value > 0);
}

// Advent begins on the fourth Sunday before Christmas Day, which is the Sunday
// that falls from November 27 to December 3.
export function adventStart(year) {
  const day = new Date(year, 10, 27);
  day.setDate(27 + ((7 - day.getDay()) % 7));
  return day;
}

// Which of the seasons in data/themes.json a date falls in, by the reader's
// own calendar day. Advent runs to Christmas Eve, Christmas through January 5,
// and Epiphany hymns are featured from January 6 to the end of that month.
// The rest of the year has no season here, and Advent is the next one.
export function seasonOn(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 0) return { id: day <= 5 ? "christmas" : "epiphany", next: null };
  if (month === 11 && day >= 25) return { id: "christmas", next: null };
  const start = adventStart(year);
  const today = new Date(year, month, day);
  if (today >= start) return { id: "advent", next: null };
  return {
    id: null,
    next: { id: "advent", start, days: Math.round((start - today) / DAY_MS) },
  };
}

export function longDate(date) {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function endsSentence(line) {
  return /[.;:!?]["')\]]*$/.test(String(line).trim());
}

// A few opening lines to show on the welcome page: at most `max`, cut back to
// the last line that closes a clause so the excerpt does not stop mid thought.
export function excerptLines(hymn, max = 4) {
  if (!canFeature(hymn)) return [];
  const lines = (hymn.stanzas[0] || []).slice(0, max);
  for (let end = lines.length; end >= 2; end -= 1) {
    if (endsSentence(lines[end - 1])) return lines.slice(0, end);
  }
  return lines;
}

function themeHymns(themes, hymns, id) {
  const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));
  return hymnsInTheme(themes, id)
    .map((number) => byNumber.get(number))
    .filter(canFeature);
}

// The hymns the welcome page features: from the season the date falls in, or
// from All Year outside one. Only hymns shown whole are chosen. Those with a
// recording come first, and the starting point moves on one hymn each day so
// the page is not the same every visit.
export function featuredHymns({ hymns, themes, recordings, music, date, limit = 4 }) {
  const all = Array.isArray(hymns) ? hymns : [];
  const season = seasonOn(date);
  let theme = season.id ? findTheme(themes, season.id) : null;
  let pool = theme ? themeHymns(themes, all, theme.id) : [];
  let kind = "season";
  if (pool.length === 0) {
    theme = findTheme(themes, "all-year");
    pool = theme ? themeHymns(themes, all, theme.id) : [];
    kind = "year";
  }
  if (pool.length === 0) {
    theme = null;
    pool = sortByNumber(all).filter(canFeature);
    kind = "plain";
  }
  const ordered = pool
    .map((hymn) => ({
      hymn,
      recorded: recordingCount(recordings, hymn) > 0,
      score: hasScore(music, hymn),
    }))
    .sort((a, b) => Number(b.recorded) - Number(a.recorded) || a.hymn.number - b.hymn.number);
  const picks = [];
  if (ordered.length > 0) {
    const offset = dayNumber(date) % ordered.length;
    const total = Math.min(limit, ordered.length);
    for (let index = 0; index < total; index += 1) {
      const item = ordered[(offset + index) % ordered.length];
      picks.push({ ...item, lines: excerptLines(item.hymn) });
    }
  }

  let upcoming = null;
  if (season.next && season.next.days <= UPCOMING_DAYS) {
    const nextTheme = findTheme(themes, season.next.id);
    if (nextTheme && themeHymns(themes, all, nextTheme.id).length > 0) {
      upcoming = { theme: nextTheme, start: season.next.start, when: longDate(season.next.start) };
    }
  }
  return { kind, theme, hymns: picks, upcoming };
}

// One hymn to point at for "hear it" and one for "see the music", so those
// links always land on a page that has the thing they promise.
export function exampleHymns({ hymns, recordings, music, prefer = [] }) {
  const all = sortByNumber(Array.isArray(hymns) ? hymns : []).filter(canFeature);
  const ordered = [...prefer.filter(canFeature), ...all];
  return {
    recorded: ordered.find((hymn) => recordingCount(recordings, hymn) > 0) || null,
    score: ordered.find((hymn) => hasScore(music, hymn)) || null,
  };
}

// Seasons that have at least one hymn Hark is not withholding.
export function seasonLinks(themes, hymns) {
  const byNumber = new Map((Array.isArray(hymns) ? hymns : []).map((hymn) => [hymn.number, hymn]));
  return ((themes && themes.seasons) || []).filter((season) =>
    hymnsInTheme(themes, season.id).some((number) => {
      const hymn = byNumber.get(number);
      return hymn && !isWithheld(hymn);
    }),
  );
}

// Where the welcome search box goes. A number that is exactly one hymn opens
// that hymn. Anything else opens the list with the search filled in.
export function searchTarget(hymns, query) {
  const text = String(query || "").trim();
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    if ((Array.isArray(hymns) ? hymns : []).some((hymn) => hymn.number === number && inHymnal(hymn))) {
      return { hash: `#/hymn/${number}`, query: "" };
    }
  }
  return { hash: "#/", query: text };
}

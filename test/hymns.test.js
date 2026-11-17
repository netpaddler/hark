import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { pushBlockReason, pushConfig, pushOpen, urlBase64ToBytes } from "../config/push.js";
import { requestConfig, requestsOpen } from "../config/requests.js";
import { INSTALL_URL, installGuide } from "../install.js";
import { isLiked, likeButtonState, likedHymns, readLikes, toggleLike } from "../likes.js";
import { changelogDateLabel, groupChangelog } from "../changelog.js";
import { SITE, buildFeed } from "../scripts/build-feed.mjs";
import { entriesToAnnounce, pushNotice } from "../worker/src/push-notice.js";
import { captionEnd, estimatedEnd, nextEndingSong, nextPlay, playbackStop, shuffleTracks, songsFromNumber, songsWithEndings, themeTracks, tracksForHymns } from "../playlist.js";
import { bytesToBase64Url, decryptPayload, encryptPayload } from "../worker/src/webpush.js";
import {
  authorIndex,
  browse,
  classifyRecording,
  faithRecordings,
  filterHymns,
  formatRecordingDate,
  gapNote,
  isWithheld,
  wordsPending,
  listRecordings,
  listSections,
  neighbors,
  partialNote,
  stanzaPlan,
  findTheme,
  hymnsInTheme,
  themeOutline,
  themesForHymn,
  titleLetter,
  titleSortKey,
  tuneCaution,
  youtubeEmbedSrc,
  youtubeBlock,
  listSermons,
} from "../hymn-model.js";
import {
  NEWCOMER_KEY,
  RETURNING_KEY,
  adventStart,
  canFeature,
  everyTextPublicDomain,
  exampleHymns,
  excerptLines,
  featuredHymns,
  hasWords,
  searchTarget,
  seasonLinks,
  seasonOn,
  statItems,
  welcomeCopy,
  welcomeStats,
} from "../welcome.js";

const hymns = JSON.parse(readFileSync(new URL("../data/hymns.json", import.meta.url), "utf8"));
const recordings = JSON.parse(readFileSync(new URL("../data/recordings.json", import.meta.url), "utf8"));
const themes = JSON.parse(readFileSync(new URL("../data/themes.json", import.meta.url), "utf8"));
const sins = JSON.parse(readFileSync(new URL("../data/sins.json", import.meta.url), "utf8"));
const sermons = JSON.parse(readFileSync(new URL("../data/sermons.json", import.meta.url), "utf8"));
const music = JSON.parse(readFileSync(new URL("../data/music.json", import.meta.url), "utf8"));
const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));

function groups() {
  return authorIndex(hymns).flatMap((bucket) => bucket.groups);
}

function group(label) {
  const found = groups().find((item) => item.label === label);
  assert.ok(found, label);
  return found;
}

test("loads the Trinity Hymnal hymns in number order", () => {
  assert.equal(hymns.length, 90);
  const numbers = hymns.map((hymn) => hymn.number);
  assert.deepEqual([...numbers].sort((a, b) => a - b), numbers, "hymns are in number order");
  assert.equal(new Set(numbers).size, numbers.length, "no number appears twice");
  // The 1990 Trinity Hymnal runs to 742.
  for (const number of numbers) assert.ok(number >= 1 && number <= 742, String(number));
  assert.deepEqual(numbers.slice(0, 6), [2, 15, 31, 34, 38, 56]);
  assert.deepEqual(numbers.slice(-4), [652, 656, 691, 700]);
  assert.deepEqual(listSections(hymns), [
    "Advent",
    "Christmas",
    "God's Work: His Decrees",
    "The Church: Evening",
    "The Christian Life: Obedience",
  ]);
  assert.equal(byNumber.get(108).stanzas[0][0], "Whate'er my God ordains is right:");
  assert.equal(byNumber.get(401).tune, "TALLIS' CANON");
  assert.equal(byNumber.get(559).composer, "Charles Steggal, 1826-1905");
  assert.equal(byNumber.get(203).stanzas[0][0], "Hark! the herald angels sing,");
});

test("sections and copyright flags stay intact", () => {
  for (const hymn of hymns) {
    assert.equal(hymn.stanzas.length, hymn.stanza_numbers.length, String(hymn.number));
    if (hymn.public_domain === false) assert.equal(hymn.stanzas.length, 0, String(hymn.number));
  }
  assert.deepEqual(
    hymns.filter((hymn) => isWithheld(hymn)).map((hymn) => hymn.number),
    [],
  );
});

test("search matches number, title, and a lyric line", () => {
  assert.deepEqual(
    filterHymns(hymns, "203").map((hymn) => hymn.number),
    [203],
  );
  assert.ok(filterHymns(hymns, "herald angels").some((hymn) => hymn.number === 203));
  assert.ok(filterHymns(hymns, "O come, O come, Emmanuel").some((hymn) => hymn.number === 194));
  assert.ok(filterHymns(hymns, "rejoice emmanuel").some((hymn) => hymn.number === 194));
  assert.ok(filterHymns(hymns, "watts").some((hymn) => hymn.number === 195));
  assert.ok(filterHymns(hymns, "picardy").some((hymn) => hymn.number === 193));
  const twenties = filterHymns(hymns, "20").map((hymn) => hymn.number);
  assert.ok(twenties.includes(203));
  assert.ok(!twenties.includes(193));
});

test("section filter combines with search", () => {
  assert.deepEqual(
    filterHymns(hymns, "", "Advent").map((hymn) => hymn.number),
    [193, 194, 195, 196, 197, 198],
  );
  const christmas = filterHymns(hymns, "", "Christmas").map((hymn) => hymn.number);
  assert.ok(christmas.includes(162));
  assert.ok(!christmas.includes(194));
  assert.deepEqual(
    browse(hymns, { section: "Advent", mode: "title" }).letters.flatMap((bucket) =>
      bucket.hymns.map((hymn) => hymn.number),
    ),
    [196, 197, 195, 193, 198, 194],
  );
});

test("title index is alphabetical and ignores a leading article", () => {
  assert.equal(titleLetter("The First Noel"), "F");
  assert.equal(titleLetter("A Mighty Fortress"), "M");
  assert.equal(titleLetter("An Upper Room"), "U");
  assert.equal(titleLetter("All Creatures of Our God and King"), "A");
  assert.ok(titleSortKey("The First Noel") < titleSortKey("While Shepherds Watched"));
  assert.equal(titleLetter("Hark! The Herald Angels Sing"), "H");
  const listed = browse(hymns, { mode: "title" }).letters.flatMap((bucket) =>
    bucket.hymns.map((hymn) => hymn.title),
  );
  assert.equal(listed.length, hymns.length, "every hymn is filed under a letter");
  const keys = listed.map((title) => titleSortKey(title));
  assert.deepEqual([...keys].sort(), keys, "titles are in sort-key order");
  // Leading articles are ignored, so these sit under T and A, not under T twice.
  const order = browse(hymns, { mode: "title" }).letters.map((bucket) => bucket.letter);
  assert.deepEqual([...order].sort(), order, "letters ascend");
  assert.ok(order.includes("A") && order.includes("W"));
});

test("author index files people by surname and keeps translators", () => {
  const all = groups();
  assert.equal(all.length, 70);
  assert.deepEqual(group("Rodigast, Samuel").hymns.map((item) => item.hymn.number), [108]);
  assert.deepEqual(group("Ken, Thomas").hymns.map((item) => item.hymn.number), [401]);
  assert.deepEqual(group("Waring, Anna Laetitia").hymns.map((item) => item.hymn.number), [559]);
  assert.ok(all.every((item) => !/^mod\.?$/i.test(item.label)));
  assert.deepEqual(
    group("Neale, John Mason (tr.)").hymns.map((item) => item.hymn.number),
    [162, 194, 207, 539],
  );
  assert.deepEqual(
    group("Watts, Isaac").hymns.map((item) => item.hymn.number),
    [31, 195, 301, 700],
  );
  assert.deepEqual(
    group("Wesley, Charles").hymns.map((item) => item.hymn.number),
    [196, 203],
  );
  assert.equal(group("Moultrie, Gerard (para.)").label.endsWith("(para.)"), true);
  assert.deepEqual(
    group("Latin hymn").hymns.map((item) => item.hymn.number),
    [194, 208],
  );
  assert.deepEqual(
    group("Hunt, Mark E.").hymns.map((item) => [item.hymn.number, item.mark]),
    [[196, null]],
  );
  assert.deepEqual(
    group("Winkworth, Catherine (tr.)").hymns.map((item) => item.hymn.number),
    [108, 197, 198, 217, 602],
  );
  const indexed = new Set(all.flatMap((item) => item.hymns.map((entry) => entry.hymn.number)));
  // Hymns listed from a bulletin carry no author yet, so they are reachable by
  // number and title but cannot be filed under a person. Everything with a
  // credit must be.
  for (const hymn of hymns) {
    if (!hymn.author && !hymn.translator) {
      assert.equal(indexed.has(hymn.number), false, `${hymn.number} has no credit`);
      continue;
    }
    assert.ok(indexed.has(hymn.number), String(hymn.number));
  }
});

test("partial and withheld hymns describe what is missing", () => {
  const plan = stanzaPlan(byNumber.get(196));
  assert.deepEqual(
    plan.map((block) => (block.type === "stanza" ? block.number : block.note)),
    [
      1,
      "Stanza 2. Words are under copyright and are not reproduced here. InterVarsity Christian Fellowship, 1978.",
      "Stanza 3. Words are under copyright and are not reproduced here. InterVarsity Christian Fellowship, 1978.",
      4,
    ],
  );
  assert.match(partialNote(byNumber.get(196)), /^Stanzas 2 and 3 are by Mark E\. Hunt/);
  assert.equal(partialNote(byNumber.get(108)), null);
  const emmanuel = stanzaPlan(byNumber.get(194));
  assert.equal(emmanuel.filter((block) => block.type === "refrain").length, 5);
  assert.deepEqual(
    stanzaPlan(byNumber.get(203)).map((block) => block.type),
    ["stanza", "refrain", "stanza", "refrain", "stanza", "refrain"],
  );
  assert.equal(gapNote([5]), "Stanza 5 is omitted.");
  assert.equal(gapNote([2, 3, 4]), "Stanzas 2, 3, and 4 are omitted.");
});

test("neighbors follow hymnal number", () => {
  const around = neighbors(hymns, 203);
  assert.equal(around.prev.number, 201);
  assert.equal(around.next.number, 204);
  assert.equal(neighbors(hymns, 2).prev, null, "2 is the lowest number held");
  assert.equal(neighbors(hymns, 15).prev.number, 2);
  assert.equal(neighbors(hymns, 108).prev.number, 99);
  assert.equal(neighbors(hymns, 162).prev.number, 115);
  assert.equal(neighbors(hymns, 227).next.number, 253);
  assert.equal(neighbors(hymns, 700).next, null, "700 is the highest number held");
  assert.equal(neighbors(hymns, 999).hymn, null);
});

test("every hymn has a season and every theme tag is a real hymn", () => {
  const numbers = new Set(hymns.map((hymn) => hymn.number));
  const seasonIds = new Set(themes.seasons.map((item) => item.id));
  const topicIds = new Set(themes.topics.map((item) => item.id));
  const defined = new Set([...seasonIds, ...topicIds]);
  assert.equal(themes.seasons.map((item) => item.id).join(","), "advent,christmas,epiphany,all-year");
  for (const hymn of hymns) {
    assert.equal(hymn.themes, undefined);
    const entry = themes.hymns[String(hymn.number)];
    assert.ok(entry, `missing themes for ${hymn.number}`);
    assert.ok(entry.seasons.length >= 1, `no season for ${hymn.number}`);
    for (const id of [...entry.seasons, ...entry.topics]) {
      assert.ok(defined.has(id), `${hymn.number} has unknown theme ${id}`);
    }
    if (hymn.section === "Advent") assert.ok(entry.seasons.includes("advent"));
    if (hymn.section === "Christmas") assert.ok(entry.seasons.includes("christmas"));
  }
  for (const id of defined) {
    const users = hymnsInTheme(themes, id);
    assert.ok(users.length >= 1, `${id} is used ${users.length} time`);
    for (const number of users) assert.ok(numbers.has(number), `${id} lists ${number}`);
  }
  for (const key of Object.keys(themes.hymns)) assert.ok(numbers.has(Number(key)), key);
  assert.deepEqual(hymnsInTheme(themes, "epiphany"), [206, 213, 218, 226]);
  assert.ok(!hymnsInTheme(themes, "advent").includes(203));
  assert.ok(themesForHymn(themes, 203).some((item) => item.id === "incarnation"));
  assert.equal(findTheme(themes, "incarnation").title, "The Incarnation");
  const advent = themeOutline(themes, hymns, { section: "Advent" });
  assert.deepEqual(
    advent.seasons.map((group) => group.id),
    ["advent"],
  );
  assert.equal(byNumber.get(203).stanzas[0][0], "Hark! the herald angels sing,");
  assert.deepEqual(themes.hymns["108"], { seasons: ["all-year"], topics: ["providence", "trust-trials"] });
  assert.deepEqual(themes.hymns["559"], { seasons: ["all-year"], topics: ["providence", "contentment"] });
  assert.deepEqual(themes.hymns["401"], { seasons: ["all-year"], topics: ["evening", "joy"] });
  const allYear = hymnsInTheme(themes, "all-year");
  for (const number of [108, 401, 559]) assert.ok(allYear.includes(number), String(number));
  // Bulletin hymns land here until someone sorts them into a season.
  assert.ok(allYear.includes(15) && allYear.includes(691));
  assert.equal(allYear.length, 60);
});

test("every recording belongs to a hymn that is in the book", () => {
  const numbers = new Set(hymns.map((hymn) => hymn.number));
  for (const key of Object.keys(recordings)) {
    assert.equal(numbers.has(Number(key)), true, key);
    assert.ok(Array.isArray(recordings[key]) && recordings[key].length > 0, key);
  }
});

test("Faith Presbyterian recordings stay out of the hymn file and sort newest first", () => {
  assert.equal(Object.keys(recordings).length, 89);
  assert.equal(Object.values(recordings).reduce((sum, items) => sum + items.length, 0), 303);
  assert.equal(faithRecordings(recordings, 108)[0].dateSort, "2025-12-14");
  assert.equal(faithRecordings(recordings, 401).length, 1);
  assert.equal(faithRecordings(recordings, 559)[0].dateSort, "2026-07-19");
  assert.equal(faithRecordings(recordings, 162).length, 8);
  assert.equal(faithRecordings(recordings, 198).length, 8);
  const herald = faithRecordings(recordings, 203);
  assert.equal(herald.length, 9);
  assert.equal(herald[0].date, "Dec 28, 2025");
  assert.equal(herald[0].dateSort, "2025-12-28");
  assert.ok(herald[0].url.includes("t="));
  assert.match(herald[0].embed, /start=\d+$/);
  assert.equal(herald[0].confidence, undefined);
  assert.equal(herald[0].notes, undefined);
  assert.deepEqual(
    herald.map((item) => item.dateSort),
    [...herald.map((item) => item.dateSort)].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
  );
  assert.equal(faithRecordings(recordings, 200).length, 0);
  assert.equal(faithRecordings(recordings, 211).length, 2);
  const bethlehem = faithRecordings(recordings, 201);
  assert.equal(bethlehem.length, 3);
  assert.deepEqual(
    bethlehem.map((item) => item.label),
    [
      "Christmas Eve Candlelight Service, 9:00 pm, Dec 24, 2023, congregation",
      "Christmas Eve Candlelight Service, 4:00 pm, Dec 24, 2023, congregation",
      "Sunday Morning Worship, Dec 19, 2021, congregation",
    ],
  );
  assert.deepEqual(
    bethlehem.map((item) => item.url),
    [
      "https://www.youtube.com/watch?v=QBbNqTNJB_E&t=2223s",
      "https://www.youtube.com/watch?v=GcyYETKpWVI&t=2040s",
      "https://www.youtube.com/watch?v=Sw8wfS8jI68&t=5486s",
    ],
  );
  assert.equal(
    faithRecordings(recordings, 221)[0].url,
    "https://www.youtube.com/watch?v=pThh6ak-Jfw&t=4794s",
  );
  const away = faithRecordings(recordings, 204);
  const awayOther = faithRecordings(recordings, 205);
  assert.equal(away.length, 1);
  assert.equal(away[0].url, awayOther[0].url);
  assert.equal(
    faithRecordings(recordings, 222).map((item) => item.url).join("|"),
    faithRecordings(recordings, 223).map((item) => item.url).join("|"),
  );
  assert.match(tuneCaution(204), /tune sung may differ/);
  assert.match(tuneCaution(204), /no\. 205/);
  assert.match(tuneCaution(223), /no\. 222/);
  assert.equal(tuneCaution(203), "");
  assert.equal(formatRecordingDate("2026-04-26"), "Apr 26, 2026");
  const reversed = faithRecordings(
    { 1: [recordings["203"][recordings["203"].length - 1], recordings["203"][0]] },
    1,
  );
  assert.equal(reversed[0].dateSort, "2025-12-28");
  assert.equal(youtubeEmbedSrc("abcdefghijk", 120), "https://www.youtube-nocookie.com/embed/abcdefghijk?start=120");
});

test("recordings accept audio files and YouTube links", () => {
  assert.deepEqual(classifyRecording("recordings/203.mp3"), {
    kind: "audio",
    url: "recordings/203.mp3",
  });
  assert.equal(classifyRecording("https://www.youtube.com/watch?v=abcdefghijk").kind, "youtube");
  assert.equal(classifyRecording("https://youtu.be/abcdefghijk").id, "abcdefghijk");
  assert.equal(classifyRecording("https://example.com/choir.mp4").kind, "video");
  assert.equal(classifyRecording("javascript:alert(1)"), null);
  const listed = listRecordings({
    recordings: [
      { label: "Choir rehearsal", url: "recordings/203.mp3" },
      { label: " ", url: "https://www.youtube.com/watch?v=abcdefghijk" },
      { label: "Bad", url: "javascript:alert(1)" },
    ],
  });
  assert.equal(listed.length, 2);
  assert.equal(listed[0].label, "Choir rehearsal");
  assert.equal(listed[1].label, "Choir recording");
  assert.deepEqual(listRecordings(byNumber.get(203)), []);
});

test("sins page quotes the catechism and Scripture, and stays out of hymn search", () => {
  assert.equal(sins.intro.catechism.number, 14);
  assert.equal(sins.intro.catechism.question, "What is sin?");
  assert.equal(
    sins.intro.catechism.answer,
    "Sin is any want of conformity unto, or transgression of, the law of God.",
  );
  const commandments = sins.groups.find((group) => group.id === "commandments");
  assert.deepEqual(
    commandments.items.map((item) => item.catechism.number),
    [47, 51, 55, 61, 65, 69, 72, 75, 78, 81],
  );
  for (const item of commandments.items) {
    assert.match(item.catechism.question, /^What is forbidden in the/);
    assert.ok(item.scripture.length > 0, item.id);
    assert.match(item.reference, /^Exodus 20:/);
  }
  const flesh = sins.groups.find((group) => group.id === "flesh");
  assert.equal(flesh.reference, "Galatians 5:19-21");
  assert.ok(flesh.items.includes("fornication"));
  assert.ok(flesh.items.includes("revellings, and such like"));
  assert.match(flesh.closing, /shall not inherit the kingdom of God/);
  const hates = sins.groups.find((group) => group.id === "hates");
  assert.equal(hates.items.length, 7);
  assert.equal(hates.items[0], "A proud look");
  assert.equal(hates.items[6], "he that soweth discord among brethren");
  const heart = sins.groups
    .find((group) => group.id === "heart-tongue")
    .parts.find((part) => part.id === "heart");
  assert.match(heart.scripture[0], /^For out of the heart proceed/);
  assert.equal(sins.gospel.catechism.number, 87);
  assert.match(sins.gospel.catechism.answer, /^Repentance unto life is a saving grace/);
  assert.equal(sins.gospel.verses[0].reference, "1 John 1:9");
  assert.match(sins.gospel.verses[0].text, /^If we confess our sins/);
  assert.equal(sins.gospel.verses[1].reference, "1 Timothy 1:15");
  assert.match(sins.gospel.verses[1].text, /Christ Jesus came into the world to save sinners/);

  const linked = [
    ...heart.hymns,
    ...sins.gospel.hymns,
  ];
  assert.ok(linked.length > 0);
  for (const number of linked) {
    const hymn = byNumber.get(number);
    assert.ok(hymn, String(number));
    const words = hymn.stanzas.flat().join(" ");
    assert.match(words, /sin|repent|pardon|grace|redeem|sinner/i, String(number));
  }
  assert.equal(
    filterHymns(hymns, "any want of conformity").length,
    0,
  );
  assert.deepEqual(sermons["proverbs-6"], []);
  const pageSermons = listSermons(sermons, "page");
  assert.deepEqual(
    pageSermons.map((item) => item.title),
    ["Confession of Sin", "The Father's Grace for Lost Sons, Near and Far"],
  );
  assert.equal(pageSermons[0].preacher, "Rev. Steven Nicoletti");
  assert.equal(pageSermons[0].text, "2 Samuel 12:1-15a; Psalm 51");
  assert.equal(pageSermons[0].url, "https://www.youtube.com/watch?v=QqLbMP9hiCU&t=708s");
  assert.equal(pageSermons[0].embed, "https://www.youtube-nocookie.com/embed/QqLbMP9hiCU?start=708");
  assert.equal(pageSermons[0].note, undefined);
  assert.equal(pageSermons[0].service, undefined);
  assert.equal(listSermons(sermons, "proverbs-6").length, 0);
  assert.equal(
    listSermons(sermons, "ten-commandments")[0].url,
    "https://www.youtube.com/watch?v=u-wcjHgvM-w&t=2503s",
  );
  assert.equal(listSermons(sermons, "works-of-the-flesh")[0].text, "Galatians 5:13-26");
  assert.equal(listSermons(sermons, "heart-and-tongue").length, 2);
  const allowed = new Set([
    "https://www.youtube.com/watch?v=QqLbMP9hiCU&t=708s",
    "https://www.youtube.com/watch?v=pdh9xm-iSio&t=1990s",
    "https://www.youtube.com/watch?v=u-wcjHgvM-w&t=2503s",
    "https://www.youtube.com/watch?v=ytvEg1w_xRU&t=1844s",
    "https://www.youtube.com/watch?v=ucdGQ4-Fl8I&t=2329s",
    "https://www.youtube.com/watch?v=HelgRs0r2Pw&t=2134s",
  ]);
  for (const key of ["page", "ten-commandments", "works-of-the-flesh", "heart-and-tongue"]) {
    for (const item of listSermons(sermons, key)) assert.ok(allowed.has(item.url), item.url);
  }
  const shown = listSermons(
    {
      page: [{ title: "Blank", url: "" }],
      groups: {
        gospel: [
          {
            title: "The gospel",
            date: "2024-03-03",
            preacher: "A preacher",
            text: "1 John 1:9",
            url: "https://www.youtube.com/watch?v=abcdefghijk",
            start_seconds: 90,
          },
          { title: "Missing link" },
          { title: "Bad", url: "javascript:alert(1)" },
        ],
      },
    },
    "gospel",
  );
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "The gospel");
  assert.equal(shown[0].preacher, "A preacher");
  assert.equal(shown[0].url, "https://www.youtube.com/watch?v=abcdefghijk&t=90s");
  assert.equal(shown[0].embed, "https://www.youtube-nocookie.com/embed/abcdefghijk?start=90");
  const pageOrder = listSermons(
    {
      page: [
        { title: "First", url: "https://www.youtube.com/watch?v=abcdefghijk", date: "2020-01-01" },
        { title: "Second", url: "https://www.youtube.com/watch?v=bcdefghijkl", date: "2024-01-01" },
      ],
    },
    "page",
  );
  assert.deepEqual(
    pageOrder.map((item) => item.title),
    ["First", "Second"],
  );
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.equal(appSource.includes("https://www.youtube.com/watch?v=aAhA7KfbJgg"), true);
  assert.equal(
    appSource.includes(
      "Of course, we can't just stop it on our own. Repentance unto life is a saving grace (WSC Q. 87), and Christ came to save sinners (1 Timothy 1:15).",
    ),
    true,
  );
  assert.equal((appSource.match(/STOP IT!/g) || []).length, 0);
  assert.equal(/\u2013|\u2014/.test(JSON.stringify(sins)), false);
  assert.equal(/\u2013|\u2014/.test(JSON.stringify(sermons)), false);
});

test("videos marked embeddable false never render an iframe", () => {
  const blocked = new Set([
    "KF2s2d68Mgs",
    "M4QAVBdJYQ0",
    "QqLbMP9hiCU",
    "SExoOIkPndE",
    "WAcu9DsU2Oo",
    "Xn2S7fum_lI",
    "gyux6d9UtBM",
    "qTBSS6y3nTw",
    "r-Ueu-KXYf8",
    "ytvEg1w_xRU",
  ]);
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const watch = appSource.slice(appSource.indexOf("function watchCard"), appSource.indexOf("function mountYoutube"));
  assert.equal(watch.includes("iframe"), false);
  assert.match(appSource, /if \(block\.type === "card"\) return watchCard\(block\)/);
  const entries = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.url === "string") entries.push(value);
    else for (const item of Object.values(value)) walk(item);
  };
  walk(sermons);
  walk(recordings);
  let marked = 0;
  for (const entry of entries) {
    const match = entry.url.match(/[?&]v=([A-Za-z0-9_-]+)/);
    if (!match || !blocked.has(match[1])) continue;
    assert.equal(entry.embeddable, false, entry.url);
    const presented = entry.title ? listSermons({ page: [entry] }, "page")[0] : faithRecordings({ 1: [entry] }, 1)[0];
    const block = youtubeBlock(presented);
    assert.equal(block.type, "card");
    assert.equal(Object.hasOwn(block, "src"), false);
    assert.equal(block.label, "Watch on YouTube");
    assert.equal(block.thumb, `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`);
    assert.match(block.href, /[?&]t=\d+/);
    marked += 1;
  }
  assert.equal(marked, 15);
  const confession = listSermons(sermons, "page")[0];
  assert.equal(confession.title, "Confession of Sin");
  assert.equal(youtubeBlock(confession).type, "card");
  assert.equal(youtubeBlock(listSermons(sermons, "page")[1]).type, "iframe");
});

// Reads the address back out of icons/hark-qr.svg, so the picture and
// INSTALL_URL cannot drift apart. It reads an undamaged code only: it does no
// error correction, and it knows versions 1 to 6 in byte mode, which is far
// more room than a short address needs.
const QR_DATA_BLOCKS = {
  1: { L: [19], M: [16], Q: [13], H: [9] },
  2: { L: [34], M: [28], Q: [22], H: [16] },
  3: { L: [55], M: [44], Q: [17, 17], H: [13, 13] },
  4: { L: [80], M: [32, 32], Q: [24, 24], H: [9, 9, 9, 9] },
  5: { L: [108], M: [43, 43], Q: [15, 15, 16, 16], H: [11, 11, 12, 12] },
  6: { L: [68, 68], M: [27, 27, 27, 27], Q: [19, 19, 19, 19], H: [15, 15, 15, 15] },
};

const QR_MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// The dark squares, as rows of true and false, with the quiet border removed.
function qrModules(svg) {
  const path = svg.match(/<path class="qrline"[^>]* d="([^"]+)"/)[1];
  const step = /([Mmh])(-?[\d.]+)(?: (-?[\d.]+))?/g;
  assert.equal(path.replace(step, ""), "", "the code is drawn with M, m and h only");
  const dark = [];
  let x = 0;
  let y = 0;
  for (const [, command, first, second] of path.matchAll(step)) {
    if (command === "M") [x, y] = [Number(first), Number(second)];
    else if (command === "m") [x, y] = [x + Number(first), y + Number(second)];
    else {
      for (let i = 0; i < Number(first); i += 1) dark.push([x + i, Math.floor(y)]);
      x += Number(first);
    }
  }
  const border = Math.min(...dark.map(([column]) => column));
  const size = Math.max(...dark.map(([column]) => column)) - border + 1;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  for (const [column, row] of dark) grid[row - border][column - border] = true;
  return grid;
}

function readQr(svg) {
  const grid = qrModules(svg);
  const size = grid.length;
  const version = (size - 17) / 4;

  // Fifteen format bits beside the top left corner say how much of the code
  // is spare and which pattern was laid over the data.
  const formatCells = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  let format = 0;
  formatCells.forEach(([x, y], bit) => {
    if (grid[y][x]) format |= 1 << bit;
  });
  format ^= 0x5412;
  const level = ["M", "L", "H", "Q"][format >> 13];
  const mask = QR_MASKS[(format >> 10) & 7];
  const blocks = QR_DATA_BLOCKS[version] && QR_DATA_BLOCKS[version][level];
  assert.ok(blocks, `QR version ${version} level ${level} is not one this test can read`);

  // The corner squares, the timing lines and the small alignment square hold
  // no data.
  const reserved = (x, y) =>
    (x < 9 && y < 9) ||
    (x >= size - 8 && y < 9) ||
    (x < 9 && y >= size - 8) ||
    x === 6 ||
    y === 6 ||
    (version > 1 && x >= size - 9 && x <= size - 5 && y >= size - 9 && y <= size - 5);

  // Data runs in two-column strips from the right edge, up then down.
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let n = 0; n < size; n += 1) {
      const y = upward ? size - 1 - n : n;
      for (const x of [right, right - 1]) {
        if (!reserved(x, y)) bits.push(grid[y][x] !== mask(x, y) ? 1 : 0);
      }
    }
  }
  const codewords = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    codewords.push(Number.parseInt(bits.slice(i, i + 8).join(""), 2));
  }

  // The data is dealt out across its blocks one byte at a time.
  const data = blocks.map(() => []);
  let next = 0;
  for (let i = 0; i < Math.max(...blocks); i += 1) {
    blocks.forEach((length, block) => {
      if (i < length) data[block].push(codewords[next++]);
    });
  }
  const stream = data.flat().map((byte) => byte.toString(2).padStart(8, "0")).join("");
  assert.equal(stream.slice(0, 4), "0100", "the address is stored in byte mode");
  const length = Number.parseInt(stream.slice(4, 12), 2);
  const bytes = [];
  for (let i = 0; i < length; i += 1) {
    bytes.push(Number.parseInt(stream.slice(12 + i * 8, 20 + i * 8), 2));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

test("install manifest, guide, and QR code", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Hark");
  assert.equal(manifest.short_name, "Hark");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.id, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#f3eee4");
  assert.equal(manifest.background_color, "#f3eee4");
  for (const size of ["192x192", "512x512"]) {
    for (const purpose of ["any", "maskable"]) {
      const icon = manifest.icons.find((item) => item.sizes === size && item.purpose === purpose);
      assert.ok(icon, `${size} ${purpose}`);
      assert.equal(icon.src.startsWith("./icons/"), true);
      const file = icon.src.slice("./".length);
      const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
      const width = bytes.readUInt32BE(16);
      assert.equal(width, Number(size.slice(0, 3)));
      assert.equal(bytes.readUInt32BE(20), width);
    }
  }
  const svg = readFileSync(new URL("../icons/hark-qr.svg", import.meta.url), "utf8");
  assert.equal(svg.startsWith("<svg"), true);
  // The install link and the code both open the live site, not the old
  // project address, and the code really does hold the address it is
  // labelled with.
  assert.equal(INSTALL_URL, "https://hark.theweightofglory.com/");
  assert.equal(readQr(svg), INSTALL_URL);
  assert.ok(svg.includes(`<title>QR code for ${INSTALL_URL}</title>`));
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(`The live app is <${INSTALL_URL}>`));
  assert.equal(/<image[\s>]/i.test(svg), false);
  assert.equal(svg.includes("xlink:href"), false);
  assert.ok(installGuide.android.some((step) => step.includes("Add to Home screen")));
  assert.ok(installGuide.android.some((step) => step.includes("three dot menu")));
  assert.ok(installGuide.iphone.some((step) => step.includes("Share")));
  assert.ok(installGuide.iphone.some((step) => step.includes("Add to Home Screen")));
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /scope: scope\.href/);
  assert.match(appSource, /beforeinstallprompt/);
});

test("install spends the saved prompt, opens the help dialog, and a first visit does not reload", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  // A new worker claims the page on a first visit as well as on an update, so
  // the reload has to know whether a worker was already running this page.
  assert.match(appSource, /const hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
  assert.match(appSource, /if \(!hadController \|\| reloading\) return;/);

  // beforeinstallprompt is saved, and the Install Hark link spends it.
  assert.match(appSource, /beforeinstallprompt/);
  assert.match(appSource, /saved\.prompt\(\)/);
  assert.match(appSource, /await saved\.userChoice/);
  assert.match(appSource, /installLink\.addEventListener\("click"/);

  // The dialog in the shell is filled and opened when there is no native prompt.
  assert.match(page, /<dialog[^>]*id="install-help"/);
  assert.match(appSource, /function openInstallHelp\(\)/);
  assert.match(appSource, /installHelp\.showModal\(\)/);
  const fillUses = appSource.match(/fillInstallHelp\(\)/g) || [];
  assert.ok(fillUses.length >= 2, "fillInstallHelp is defined and called");
  const openUses = appSource.match(/openInstallHelp\(\)/g) || [];
  assert.ok(openUses.length >= 2, "openInstallHelp is defined and called");

  // The install page button has a style to match the other filled buttons.
  assert.match(css, /\.install-now/);
});

test("comments and requests stay closed until an endpoint is set", () => {
  assert.equal(requestConfig.repo, "netpaddler/hark");
  assert.equal(requestConfig.label, "hymn-request");
  assert.equal(requestConfig.endpoint, "https://hark-requests.netpaddler.workers.dev");
  assert.equal(requestConfig.turnstileSiteKey, "0x4AAAAAAGDxc4LmW_h1XSbx");
  assert.equal(requestsOpen(), true);
  assert.equal(requestsOpen({ endpoint: "" }), false);
  assert.equal(requestsOpen({ endpoint: "https://hark.example.workers.dev" }), true);
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
  assert.equal(page.includes("giscus"), false);
  assert.equal(appSource.includes("giscus"), false);
  assert.equal(appSource.includes("https://giscus.app/client.js"), false);
  assert.equal(page.includes(">Comments/Requests<"), true);
  assert.equal(appSource.includes("Comments/Requests open soon"), true);
  assert.equal(appSource.includes("Leave a comment or request any hymn. We read every one."), true);
  assert.equal(appSource.includes("Hymn requests are limited to the Trinity Hymnal."), false);
  assert.equal(worker.includes("Thanks for writing! Hark will reply here soon."), true);
  assert.equal(worker.includes("Hymn requests are limited to the Trinity Hymnal."), false);
  assert.equal(appSource.includes('name: "company"'), true);
  assert.equal(appSource.includes("turnstile:"), true);
  assert.match(appSource, /fetch\(requestConfig\.endpoint, \{ method: "GET"/);
  assert.match(appSource, /No requests yet\./);
  assert.match(appSource, /See more/);
  assert.match(appSource, /showSubmissions\(host, issues, 3\)/);
  assert.match(appSource, /shown \+ 5/);
  assert.equal(appSource.includes("api.github.com"), false);
  assert.equal(appSource.includes("innerHTML"), false);
  assert.match(appSource, /controllerchange/);
  assert.match(appSource, /reloading/);
  assert.equal(worker.includes("GITHUB_TOKEN"), true);
  assert.equal(worker.includes("caches.default"), true);
  assert.equal(worker.includes("max-age=60"), true);
  assert.equal(worker.includes("pull_request"), true);
  assert.equal(worker.includes("plainText"), true);
  assert.equal(/api\.github\.com/.test(worker), true);
});

test("worker list strips html, drops pull requests, and caches for 60 seconds", async () => {
  const issues = [
    {
      number: 4,
      title: "Hello <b>there</b>",
      created_at: "2026-11-16T00:00:00Z",
      html_url: "https://github.com/netpaddler/hark/issues/4",
      body: "Please add <script>alert(1)</script> hymn 12",
      comments: 1,
    },
    { number: 5, pull_request: { url: "https://github.com/netpaddler/hark/pull/5" }, title: "A pull request", comments: 0 },
  ];
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(key) {
        return store.get(key.url);
      },
      async put(key, response) {
        store.set(key.url, response);
      },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes("/comments")) {
      return new Response(
        JSON.stringify([{ user: { login: "netpaddler" }, body: "Thanks <em>yes</em>", created_at: "2026-11-16T01:00:00Z" }]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (href.includes("/issues?")) {
      return new Response(JSON.stringify(issues), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("no", { status: 404 });
  };
  try {
    const worker = await import(`../worker/src/index.js?list=${Date.now()}`);
    const env = {
      GITHUB_TOKEN: "test-token",
      ALLOWED_ORIGIN: "https://netpaddler.github.io",
      REPO: "netpaddler/hark",
      LABEL: "hymn-request",
    };
    const first = await worker.default.fetch(
      new Request("https://hark-requests.example/", { headers: { origin: "https://netpaddler.github.io" } }),
      env,
    );
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("access-control-allow-origin"), "https://netpaddler.github.io");
    assert.equal(first.headers.get("cache-control"), "public, max-age=60");
    const body = await first.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].number, 4);
    assert.equal(body[0].title, "Hello there");
    assert.equal(body[0].body, "Please add alert(1) hymn 12");
    assert.equal(body[0].html_url, "https://github.com/netpaddler/hark/issues/4");
    assert.equal(body[0].comments[0].author, "netpaddler");
    assert.equal(body[0].comments[0].body, "Thanks yes");
    globalThis.fetch = async () => {
      throw new Error("cache miss");
    };
    const second = await worker.default.fetch(new Request("https://hark-requests.example/"), env);
    const again = await second.json();
    assert.equal(again[0].number, 4);
    const blocked = await worker.default.fetch(
      new Request("https://hark-requests.example/", { headers: { origin: "https://evil.example" } }),
      env,
    );
    assert.equal(blocked.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("both hosts Hark is served from are allowed, and each gets its own header", async () => {
  const LIVE = "https://hark.theweightofglory.com";
  const PREVIOUS = "https://hymns.theweightofglory.com";
  const OLD = "https://netpaddler.github.io";
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(key) {
        return store.get(key.url);
      },
      async put(key, response) {
        store.set(key.url, response);
      },
    },
  };
  globalThis.fetch = async () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  try {
    const worker = await import(`../worker/src/index.js?origins=${Date.now()}`);
    const env = {
      GITHUB_TOKEN: "test-token",
      TURNSTILE_SECRET: "test-secret",
      ALLOWED_ORIGIN: `${LIVE},${PREVIOUS},${OLD}`,
    };
    const get = (origin) =>
      worker.default.fetch(
        new Request("https://hark-requests.example/", origin ? { headers: { origin } } : undefined),
        env,
      );
    // The domain the site actually runs on. This answered 403 before.
    const live = await get(LIVE);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("access-control-allow-origin"), LIVE);
    // The previous name stays allowed while DNS and installed copies move.
    const previous = await get(PREVIOUS);
    assert.equal(previous.status, 200);
    assert.equal(previous.headers.get("access-control-allow-origin"), PREVIOUS);
    // A list cannot go in the header, so each caller is told its own origin,
    // and vary keeps a cache from mixing them up.
    const old = await get(OLD);
    assert.equal(old.status, 200);
    assert.equal(old.headers.get("access-control-allow-origin"), OLD);
    assert.equal(old.headers.get("vary"), "Origin");
    // Anything else is still refused.
    assert.equal((await get("https://evil.example")).status, 403);
    // A single origin, with no comma, still behaves as it always did.
    const solo = await worker.default.fetch(
      new Request("https://hark-requests.example/", { headers: { origin: OLD } }),
      { ...env, ALLOWED_ORIGIN: OLD },
    );
    assert.equal(solo.status, 200);
    assert.equal(solo.headers.get("access-control-allow-origin"), OLD);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("a missing Turnstile secret closes the form instead of opening it", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };
  try {
    const worker = await import(`../worker/src/index.js?closed=${Date.now()}`);
    const env = { GITHUB_TOKEN: "test-token", ALLOWED_ORIGIN: "https://netpaddler.github.io" };
    const response = await worker.default.fetch(
      new Request("https://hark-requests.example/", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://netpaddler.github.io" },
        body: JSON.stringify({ message: "Please add hymn 12", turnstile: "token" }),
      }),
      env,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "Requests are not open yet.");
    assert.equal(calls, 0, "with no secret, nothing reaches Cloudflare or GitHub");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a post needs an origin, and reading the list does not", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const cacheStore = new Map();
  globalThis.caches = {
    default: {
      async match(key) {
        return cacheStore.get(key.url);
      },
      async put(key, response) {
        cacheStore.set(key.url, response);
      },
    },
  };
  globalThis.fetch = async () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  try {
    const worker = await import(`../worker/src/index.js?origin=${Date.now()}`);
    const env = {
      GITHUB_TOKEN: "test-token",
      TURNSTILE_SECRET: "test-secret",
      ALLOWED_ORIGIN: "https://netpaddler.github.io",
    };
    const posted = await worker.default.fetch(
      new Request("https://hark-requests.example/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Please add hymn 12", turnstile: "token" }),
      }),
      env,
    );
    assert.equal(posted.status, 403);
    const listed = await worker.default.fetch(new Request("https://hark-requests.example/"), env);
    assert.equal(listed.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test("the rate limit counts in the bound store, and in the isolate without one", async () => {
  const saved = new Map();
  const store = {
    async get(key) {
      return saved.has(key) ? saved.get(key) : null;
    },
    async put(key, value) {
      saved.set(key, value);
    },
  };
  const originalFetch = globalThis.fetch;
  let created = 0;
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    if (href.includes("challenges.cloudflare.com")) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    if (href.endsWith("/issues") && options && options.method === "POST") {
      created += 1;
      return new Response(
        JSON.stringify({ number: created, html_url: `https://github.com/netpaddler/hark/issues/${created}` }),
        { status: 201 },
      );
    }
    return new Response("{}", { status: 200 });
  };
  try {
    const worker = await import(`../worker/src/index.js?limit=${Date.now()}`);
    const base = {
      GITHUB_TOKEN: "test-token",
      TURNSTILE_SECRET: "test-secret",
      ALLOWED_ORIGIN: "https://netpaddler.github.io",
    };
    const send = (ip, env) =>
      worker.default.fetch(
        new Request("https://hark-requests.example/", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://netpaddler.github.io",
            "cf-connecting-ip": ip,
          },
          body: JSON.stringify({ message: "Please add hymn 12", turnstile: "token" }),
        }),
        env,
      );
    const shared = { ...base, RATE_LIMIT: store };
    for (let round = 1; round <= 5; round += 1) {
      assert.equal((await send("203.0.113.7", shared)).status, 200, `request ${round} should go through`);
    }
    assert.equal((await send("203.0.113.7", shared)).status, 429);
    assert.equal(JSON.parse(saved.get("rate:203.0.113.7")).length, 5);
    // A different address still has its own five.
    assert.equal((await send("203.0.113.8", shared)).status, 200);
    // With no namespace bound the isolate keeps the count itself.
    for (let round = 1; round <= 5; round += 1) {
      assert.equal((await send("198.51.100.4", base)).status, 200, `memory request ${round} should go through`);
    }
    assert.equal((await send("198.51.100.4", base)).status, 429);
    assert.equal(created, 11, "neither sixth request reaches GitHub");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("every score parses, names its source, and matches a hymn", () => {
  const code = readFileSync(new URL("../vendor/abcjs-basic-min.js", import.meta.url), "utf8");
  const sandbox = { console, setTimeout, clearTimeout, navigator: { userAgent: "node" } };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const files = new Set(readdirSync(new URL("../data/music", import.meta.url)).filter((name) => name.endsWith(".abc")));
  const used = new Set();
  const numbers = new Set(hymns.map((hymn) => String(hymn.number)));
  for (const number of numbers) {
    assert.ok(music.scores[number] || music.omitted[number], `no music record for ${number}`);
  }
  for (const [number, score] of Object.entries(music.scores)) {
    const hymn = byNumber.get(Number(number));
    assert.equal(score.tune, hymn.tune);
    assert.ok(score.source && score.source_url && score.harmony_credit);
    assert.ok(score.harmony === "SATB" || score.harmony === "melody");
    assert.equal(files.has(score.file), true, score.file);
    used.add(score.file);
    const abc = readFileSync(new URL(`../data/music/${score.file}`, import.meta.url), "utf8");
    const meter = abc.match(/^M:\s*(\S+)/m)[1];
    assert.equal(meter, score.meter, score.file);
    assert.ok(abc.includes("|"), score.file);
    const parsed = sandbox.ABCJS.parseOnly(abc);
    assert.equal(parsed[0].warnings, undefined, score.file);
    assert.equal(/\u2013|\u2014/.test(abc), false, score.file);
  }
  for (const file of files) assert.ok(used.has(file), `orphan ${file}`);
  assert.equal(music.scores["197"].harmony, "melody");
  assert.equal(music.scores["197"].unsure, true);
  assert.equal(music.scores["401"].tune, "TALLIS' CANON");
  assert.ok(music.omitted["108"]);
  assert.ok(music.omitted["559"]);
  assert.equal(/\u2013|\u2014/.test(JSON.stringify(music)), false);
});

test("abcjs loads when the music is opened, not on every page", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  // Nothing in the shell drags in half a megabyte before the first paint, and
  // the worker does not download it on a first visit either.
  assert.equal(/<script[^>]*src="[^"]*abcjs[^"]*"/.test(page), false, "no blocking script tag");
  assert.equal(sw.includes('"./vendor/abcjs-basic-min.js"'), false, "not precached");
  assert.equal(existsSync(new URL("../vendor/abcjs-basic-min.js", import.meta.url)), true);
  assert.match(appSource, /function loadAbcjs\(\)/);
  assert.match(appSource, /createElement\("script"\)/);
  assert.match(appSource, /vendor\/abcjs-basic-min\.js/);
  assert.match(appSource, /await loadAbcjs\(\)/);
  // Opening the block and pressing Play both ask for the score, so the build
  // is shared rather than run twice.
  assert.match(appSource, /if \(!pending\) pending = buildScore\(\)/);
});

test("a hymn with no words yet is a different state from one that has them", () => {
  const stub = {
    number: 742,
    title: "A Hymn Not Added Yet",
    stanzas: [],
    public_domain: null,
    notes: "Listed in a Faith Presbyterian Tacoma bulletin.",
  };
  assert.equal(isWithheld(stub), false);
  assert.equal(wordsPending(stub), true);
  assert.equal(stanzaPlan(stub).length, 0);
  // A hymn with words is neither pending nor withheld.
  assert.equal(wordsPending(byNumber.get(108)), false);
  assert.equal(isWithheld(byNumber.get(108)), false);
  // Every listed hymn now has words. The copyrighted numbers are gone.
  assert.equal(hymns.filter((hymn) => wordsPending(hymn)).length, 0);
  assert.equal(byNumber.get(53), undefined);
  assert.deepEqual(filterHymns(hymns, "53").map((hymn) => hymn.number), [253, 353, 534, 535, 539]);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /wordsPending\(hymn\)/);
  assert.match(appSource, /Words not added yet/);
});

test("bulletin hymns keep the printed words and drop fully copyrighted numbers", () => {
  assert.equal(byNumber.get(125), undefined);
  assert.equal(byNumber.get(660), undefined);
  assert.equal(byNumber.get(703), undefined);
  assert.equal(byNumber.get(719), undefined);
  assert.equal(themes.hymns["125"], undefined);
  assert.equal(music.omitted["719"], undefined);

  const though = byNumber.get(95);
  assert.equal(though.title, "Though Troubles Assail Us");
  assert.equal(though.stanzas[0][0], "Though troubles assail us and dangers affright,");
  assert.match(though.source_url, /10\.11\.26Bulletin-pm/);

  const take = byNumber.get(585);
  assert.equal(take.stanzas.length, 6);
  assert.equal(take.stanzas[5][1], "at thy feet its treasure-store.");
  assert.equal(take.stanzas[5][2], "Take my self, and I will be");
  assert.match(take.source_url, /9\.13\.26Bulletin-pm/);

  const grace = byNumber.get(460);
  assert.equal(grace.stanzas.length, 6);
  assert.match(grace.stanzas[0][0], /^Amazing grace!/);
  assert.equal(grace.stanzas[2][2], "'tis grace has brought me safe thus far,");

  const well = byNumber.get(691);
  assert.equal(well.refrain_after_each_stanza, true);
  assert.equal(well.refrain[0], "It is well with my soul;");
  assert.equal(well.stanzas.length, 4);

  for (const number of [5, 36, 46, 53, 103, 168, 239, 257, 305, 363, 415, 469, 689]) {
    assert.equal(byNumber.get(number), undefined, String(number));
    assert.equal(themes.hymns[String(number)], undefined, String(number));
    assert.equal(music.omitted[String(number)], undefined, String(number));
  }
  const stand = byNumber.get(15);
  assert.equal(stand.public_domain, true);
  assert.equal(stand.stanzas[2][3], "and wing to heav'n our thought!");
  assert.match(stand.notes, /James Montgomery, 1824, 1825; mod\./);
  assert.equal(byNumber.get(700).stanzas[4][2], "we're marching through Immanuel's ground");
  assert.equal(byNumber.get(647).stanzas[2][2], "my never-failing treas'ry filled");
});

test("the Hark title links home on the list and on a hymn", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const links = page.match(/<a class="brand-home"[^>]*>Hark<\/a>/g) || [];
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.match(link, /href="#\/"/);
    assert.match(link, /aria-label="Hark home"/);
  }
  assert.match(css, /\.brand-home\s*\{[^}]*text-decoration:\s*none/);
  assert.match(css, /\.brand-home\s*\{[^}]*color:\s*inherit/);
  assert.match(css, /\.brand-home:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /const CACHE = "hark-v\d+";/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /clients\.claim\(\)/);
  assert.match(sw, /function networkFirst/);
  assert.match(sw, /isAppModule\(url, request\) \? networkFirst\(request\)/);
});

test("shell files exist and UI copy has no en or em dashes", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const match of sw.matchAll(/"\.\/([^"]+)"/g)) {
    assert.equal(existsSync(new URL(`../${match[1]}`, import.meta.url)), true, match[1]);
  }
  const files = [
    "index.html",
    "styles.css",
    "app.js",
    "hymn-model.js",
    "playlist.js",
    "install.js",
    "likes.js",
    "changelog.js",
    "welcome.js",
    "config/requests.js",
    "config/push.js",
    "worker/src/index.js",
    "worker/src/push-notice.js",
    "worker/src/push-routes.js",
    "worker/src/webpush.js",
    "sw.js",
    "manifest.webmanifest",
    "README.md",
    "docs/data.md",
    "docs/recordings.md",
    "docs/push.md",
    "scripts/build-feed.mjs",
    "scripts/notify-push.mjs",
    "data/themes.json",
    "data/sins.json",
    "data/sermons.json",
    "data/music.json",
    "vendor/abcjs-basic-min.js",
    ".github/workflows/pages.yml",
  ];
  const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /enablement:\s*true/);
  // A pull request runs the tests. Only main reaches the deploy job.
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  for (const file of files) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(/\u2013|\u2014/.test(text), false, file);
  }
});

// Every line of welcome copy. The few that are built from a hymn or a season
// name are filled in with a stand-in, so they are checked as well.
function allStrings(value, found = []) {
  const standIn = { number: 0, title: "Advent", toString: () => "Advent" };
  if (typeof value === "string") found.push(value);
  else if (typeof value === "function") found.push(String(value(standIn, "Sunday, November 29")));
  else if (value && typeof value === "object") for (const item of Object.values(value)) allStrings(item, found);
  return found;
}

// Every calendar day from one November to the next, so each season is crossed.
function daysOfAYear() {
  const days = [];
  for (let day = new Date(2026, 10, 1); day < new Date(2027, 10, 1); day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }
  return days;
}

test("welcome counts are worked out from the data and leave withheld hymns out", () => {
  const stats = welcomeStats({ hymns, recordings, music });
  const open = hymns.filter((hymn) => hymn.public_domain !== false);
  const withWords = open.filter((hymn) => hymn.stanzas.length > 0);
  assert.equal(stats.words, withWords.length);
  assert.equal(stats.pending, open.length - withWords.length);
  assert.equal(stats.words + stats.pending, open.length);
  assert.equal(
    stats.recordings,
    open.reduce((sum, hymn) => sum + faithRecordings(recordings, hymn.number).length, 0),
  );
  assert.equal(stats.recorded, open.filter((hymn) => faithRecordings(recordings, hymn.number).length > 0).length);
  assert.equal(stats.scores, open.filter((hymn) => music.scores[String(hymn.number)]).length);
  assert.ok(stats.words > 0 && stats.recordings > 0 && stats.scores > 0);

  // Taking the withheld hymns out of the book changes none of the figures.
  assert.deepEqual(welcomeStats({ hymns: open, recordings, music }), stats);
  // Giving one a recording and a score still does not count it.
  const withheld = hymns.find((hymn) => isWithheld(hymn));
  if (withheld) {
    const key = String(withheld.number);
    const padded = welcomeStats({
      hymns,
      recordings: { ...recordings, [key]: [{ url: "https://youtu.be/abcdefghijk", video_date: "2026-01-04" }] },
      music: { ...music, scores: { ...music.scores, [key]: { tune: "X" } } },
    });
    assert.deepEqual(padded, stats);
  }

  // A hymn added or removed moves the count. Nothing is written down.
  const one = open.find((hymn) => hymn.stanzas.length > 0);
  const fewer = welcomeStats({ hymns: hymns.filter((hymn) => hymn !== one), recordings, music });
  assert.equal(fewer.words, stats.words - 1);
  assert.deepEqual(welcomeStats({ hymns: [], recordings, music }), {
    words: 0,
    pending: 0,
    recorded: 0,
    recordings: 0,
    scores: 0,
  });

  const items = statItems(stats);
  assert.deepEqual(
    items.map((item) => item.id),
    ["words", "pending", "recordings", "scores"].filter((id) => stats[id] > 0),
  );
  assert.equal(items[0].value, stats.words);
  // A zero is left off the page, and one of a thing is not called "hymns".
  assert.deepEqual(
    statItems({ words: 1, pending: 0, recorded: 0, recordings: 0, scores: 0 }).map((item) => item.label),
    ["song with its words"],
  );

  // The page reads its numbers from welcomeStats, not from digits in the copy.
  for (const text of allStrings(welcomeCopy)) {
    assert.equal(/\d/.test(text.replace("no. 0", "").replace("November 29", "")), false, text);
  }
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /statItems\(welcomeStats\(\{ hymns, recordings: recordingCatalog, music: musicCatalog \}\)\)/);
});

test("welcome says every text is public domain only while the data agrees", () => {
  assert.equal(everyTextPublicDomain(hymns), true);
  for (const hymn of hymns) {
    if (hymn.stanzas.length > 0) assert.equal(hymn.public_domain, true, String(hymn.number));
  }
  const first = hymns.find((hymn) => hymn.stanzas.length > 0);
  for (const flag of [false, null]) {
    const changed = hymns.map((hymn) => (hymn === first ? { ...hymn, public_domain: flag } : hymn));
    assert.equal(everyTextPublicDomain(changed), false);
  }
  assert.equal(everyTextPublicDomain([]), false);
  assert.equal(everyTextPublicDomain(null), false);

  assert.equal(welcomeCopy.publicDomain.claim, "Every hymn text in Hark is in the public domain.");
  assert.match(welcomeCopy.publicDomain.detail, /only its public domain stanzas are shown\.$/);
  // The second sentence is true of the one hymn it describes: the stanzas
  // under copyright are not in the file.
  const partial = hymns.filter((hymn) => hymn.public_domain !== false && hymn.copyright_note);
  for (const hymn of partial) {
    assert.ok(partialNote(hymn), String(hymn.number));
    assert.ok(hymn.stanzas.length > 0 && hymn.stanzas.length === hymn.stanza_numbers.length);
  }

  // It sits with the stats, in the main part of the page, and is guarded.
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /const claim = everyTextPublicDomain\(hymns\);/);
  assert.match(appSource, /if \(claim\) \{[\s\S]*?copy\.publicDomain\.claim[\s\S]*?copy\.publicDomain\.detail/);
  const facts = appSource.slice(appSource.indexOf("function welcomeFacts()"), appSource.indexOf("function welcomeFeatured("));
  assert.match(facts, /welcome-stats/);
  assert.match(facts, /welcome-pd/);
});

test("the seasons the welcome page follows", () => {
  // Advent Sunday, checked against the calendar for six years.
  const starts = { 2022: [10, 27], 2023: [11, 3], 2024: [11, 1], 2025: [10, 30], 2026: [10, 29], 2027: [10, 28] };
  for (const [year, [month, day]] of Object.entries(starts)) {
    const start = adventStart(Number(year));
    assert.deepEqual([start.getMonth(), start.getDate(), start.getDay()], [month, day, 0], year);
  }
  const on = (y, m, d) => seasonOn(new Date(y, m - 1, d, 15, 30)).id;
  assert.equal(on(2026, 11, 28), null);
  assert.equal(on(2026, 11, 29), "advent");
  assert.equal(on(2026, 12, 24), "advent");
  assert.equal(on(2026, 12, 25), "christmas");
  assert.equal(on(2027, 1, 5), "christmas");
  assert.equal(on(2027, 1, 6), "epiphany");
  assert.equal(on(2027, 1, 31), "epiphany");
  assert.equal(on(2027, 2, 1), null);
  assert.equal(on(2027, 7, 4), null);
  const ahead = seasonOn(new Date(2026, 10, 17, 9));
  assert.equal(ahead.next.id, "advent");
  assert.equal(ahead.next.days, 12);
  // Every season it can name is one the Themes tab has.
  for (const day of daysOfAYear()) {
    const season = seasonOn(day);
    if (season.id) assert.ok(findTheme(themes, season.id), season.id);
    else assert.ok(findTheme(themes, season.next.id), season.next.id);
  }
});

test("welcome features only hymns whose words are shown whole, and never a withheld one", () => {
  const withheld = new Set(hymns.filter((hymn) => isWithheld(hymn)).map((hymn) => hymn.number));
  const shown = new Set();
  const kinds = new Set();
  for (const day of daysOfAYear()) {
    const feature = featuredHymns({ hymns, themes, recordings, music, date: day });
    kinds.add(feature.kind);
    assert.ok(feature.hymns.length >= 1 && feature.hymns.length <= 4, day.toDateString());
    assert.equal(new Set(feature.hymns.map((pick) => pick.hymn.number)).size, feature.hymns.length);
    for (const pick of feature.hymns) {
      const hymn = pick.hymn;
      shown.add(hymn.number);
      assert.equal(byNumber.get(hymn.number), hymn, "a real hymn from the file");
      assert.equal(withheld.has(hymn.number), false, `withheld ${hymn.number}`);
      assert.equal(hymn.public_domain, true, String(hymn.number));
      assert.equal(hymn.copyright_note, null, String(hymn.number));
      assert.ok(hymn.stanzas.length > 0, String(hymn.number));
      // The lines quoted are the hymn's own opening lines, and only a few.
      assert.ok(pick.lines.length >= 1 && pick.lines.length <= 4, String(hymn.number));
      assert.deepEqual(pick.lines, hymn.stanzas[0].slice(0, pick.lines.length));
      assert.equal(pick.recorded, faithRecordings(recordings, hymn.number).length > 0);
      assert.equal(pick.score, Boolean(music.scores[String(hymn.number)]));
      if (feature.theme) {
        assert.ok(hymnsInTheme(themes, feature.theme.id).includes(hymn.number), `${hymn.number} in ${feature.theme.id}`);
      }
    }
    const season = seasonOn(day);
    if (feature.kind === "season") assert.equal(feature.theme.id, season.id);
    if (feature.kind === "year") assert.equal(feature.theme.id, "all-year");
    if (feature.upcoming) {
      assert.equal(season.id, null);
      assert.ok(season.next.days <= 28);
      assert.equal(feature.upcoming.theme.id, "advent");
    }
  }
  assert.deepEqual([...kinds].sort(), ["season", "year"]);
  assert.ok(shown.size > 10, "the picks move through the book over a year");

  const advent = featuredHymns({ hymns, themes, recordings, music, date: new Date(2026, 11, 6) });
  assert.equal(advent.kind, "season");
  assert.equal(advent.theme.title, "Advent");
  assert.equal(advent.upcoming, null);
  for (const pick of advent.hymns) assert.equal(pick.hymn.section, "Advent");
  // No. 196 has stanzas left out for copyright. It stays in the Advent list
  // and is not put on the welcome page.
  assert.equal(canFeature(byNumber.get(196)), false);
  assert.equal(hasWords(byNumber.get(196)), true);

  const before = featuredHymns({ hymns, themes, recordings, music, date: new Date(2026, 10, 17) });
  assert.equal(before.kind, "year");
  assert.equal(before.upcoming.when, "Sunday, November 29");
  assert.equal(welcomeCopy.featured.upcoming("Advent", before.upcoming.when), "Advent begins Sunday, November 29.");
  assert.equal(featuredHymns({ hymns, themes, recordings, music, date: new Date(2026, 10, 1) }).upcoming.theme.id, "advent");
  assert.equal(featuredHymns({ hymns, themes, recordings, music, date: new Date(2026, 9, 31) }).upcoming, null);
  // The hymn for the day changes from one day to the next.
  const next = featuredHymns({ hymns, themes, recordings, music, date: new Date(2026, 10, 18) });
  assert.notEqual(next.hymns[0].hymn.number, before.hymns[0].hymn.number);

  // With the withheld hymns gone from the book, the same days give the same picks.
  const open = hymns.filter((hymn) => !isWithheld(hymn));
  for (const day of [new Date(2026, 10, 17), new Date(2026, 11, 6), new Date(2026, 11, 27), new Date(2027, 0, 10)]) {
    const a = featuredHymns({ hymns, themes, recordings, music, date: day });
    const b = featuredHymns({ hymns: open, themes, recordings, music, date: day });
    assert.deepEqual(
      b.hymns.map((pick) => pick.hymn.number),
      a.hymns.map((pick) => pick.hymn.number),
    );
  }

  // A hymn that is withheld, wordless, or cut short never yields an excerpt.
  for (const hymn of hymns) {
    const lines = excerptLines(hymn);
    if (!canFeature(hymn)) assert.deepEqual(lines, [], String(hymn.number));
    else assert.ok(lines.length >= 1 && lines.length <= 4, String(hymn.number));
  }
  assert.deepEqual(excerptLines(byNumber.get(194)), byNumber.get(194).stanzas[0]);
  // The excerpt stops where a clause closes, not in the middle of one.
  assert.deepEqual(excerptLines(byNumber.get(193)), [
    "Let all mortal flesh keep silence,",
    "and with fear and trembling stand;",
  ]);

  // The links that promise a recording or a score land on a hymn that has one.
  const examples = exampleHymns({ hymns, recordings, music, prefer: before.hymns.map((pick) => pick.hymn) });
  assert.ok(faithRecordings(recordings, examples.recorded.number).length > 0);
  assert.ok(music.scores[String(examples.score.number)]);
  assert.ok(canFeature(examples.recorded) && canFeature(examples.score));
  assert.deepEqual(exampleHymns({ hymns: [], recordings, music }), { recorded: null, score: null });

  assert.deepEqual(
    seasonLinks(themes, hymns).map((season) => season.id),
    themes.seasons.map((season) => season.id),
  );
  assert.deepEqual(seasonLinks(themes, hymns.filter((hymn) => isWithheld(hymn))), []);
});

test("welcome copy names only what Hark has, and never a withheld hymn", () => {
  const strings = allStrings(welcomeCopy);
  for (const text of strings) {
    assert.equal(/\u2013|\u2014/.test(text), false, text);
    for (const hymn of hymns.filter((item) => isWithheld(item))) {
      assert.equal(text.includes(hymn.title), false, hymn.title);
    }
  }
  const all = strings.join(" ");
  // Hark has no hymn histories, devotionals, or commentary today, so the
  // page must not offer them. Take a word off this list when its feature ships.
  for (const word of [/devotion/i, /histor/i, /story/i, /biograph/i, /commentar/i]) {
    assert.equal(word.test(all), false, String(word));
  }

  // Each thing it does say is there to be found.
  const features = Object.fromEntries(welcomeCopy.features.items.map((item) => [item.id, item]));
  assert.deepEqual(Object.keys(features), ["words", "hear", "music", "themes", "sins", "offline"]);
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const model = readFileSync(new URL("../hymn-model.js", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  // Search by number, title, author, tune, or a line.
  for (const field of ["hymn.title", "hymn.author", "hymn.tune", "String(hymn.number)", "hymn.stanzas"]) {
    assert.ok(model.includes(field), field);
  }
  assert.match(features.words.text, /number, title, author, tune, or any line/);
  // Recordings open at the hymn.
  assert.match(model, /\?start=\$\{start\}/);
  // The tempo is the reader's to choose.
  assert.match(appSource, /setAttribute\("aria-label", "Tempo"\)/);
  // Seasons and topics both exist.
  assert.ok(themes.seasons.length > 0 && themes.topics.length > 0);
  // The Sins page begins and ends as the page says.
  assert.equal(sins.intro.catechism.question, "What is sin?");
  assert.ok(sins.groups.some((item) => item.title === "The Ten Commandments"));
  assert.match(sins.gospel.catechism.question, /repentance/);
  // The words are kept for offline use, and the install page exists.
  assert.ok(sw.includes('"./data/hymns.json"'));
  assert.match(appSource, /if \(path === "\/install"\)/);
  assert.equal(welcomeCopy.request.text.includes("we read every one"), true);

  for (const item of welcomeCopy.features.items) {
    if (item.href) assert.match(appSource, new RegExp(`path === "${item.href.slice(1) === "/" ? "\\/" : item.href.slice(1).replace("/", "\\/")}"`), item.href);
  }
  // The four things a visitor is asked to do.
  assert.deepEqual(Object.keys(welcomeCopy.actions), ["browse", "seasons", "install", "request"]);
  for (const href of ['href: "#/"', 'href: "#/themes"', 'href: "#/install"', 'href: "#/requests"']) {
    assert.ok(appSource.slice(appSource.indexOf("function welcomeShell()")).includes(href), href);
  }
});

test("the welcome search opens a hymn by number, or the list with the search filled in", () => {
  assert.deepEqual(searchTarget(hymns, " 203 "), { hash: "#/hymn/203", query: "" });
  assert.deepEqual(searchTarget(hymns, "742"), { hash: "#/", query: "742" });
  assert.deepEqual(searchTarget(hymns, "herald angels"), { hash: "#/", query: "herald angels" });
  assert.deepEqual(searchTarget(hymns, ""), { hash: "#/", query: "" });
  assert.deepEqual(searchTarget([], "203"), { hash: "#/", query: "203" });
});

// Runs the script in index.html that picks the opening view, the way a
// browser would, with the storage and the worker it is given.
function runEntry({ hash = "", installed = false, worker = false, stored = {}, storage = "works" }) {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = page.match(/<script id="entry-script">([\s\S]*?)<\/script>/);
  assert.ok(script, "entry script");
  const store = { ...stored };
  const dataset = installed ? { installed: "true" } : {};
  const localStorage = {
    getItem(key) {
      if (storage === "blocked") throw new Error("blocked");
      return key in store ? store[key] : null;
    },
    setItem(key, value) {
      if (storage === "blocked") throw new Error("blocked");
      store[key] = String(value);
    },
  };
  const navigator = worker === null ? {} : { serviceWorker: { controller: worker ? {} : null } };
  vm.runInNewContext(script[1], {
    document: { documentElement: { dataset } },
    localStorage,
    navigator,
    location: { hash },
  });
  return { entry: dataset.entry, view: dataset.view, store };
}

test("a first visit opens on the welcome page, and returning readers go straight to the hymns", () => {
  // Someone new: the welcome page, and the browser is marked as a newcomer.
  const first = runEntry({});
  assert.deepEqual(first, { entry: "welcome", view: "welcome", store: { [NEWCOMER_KEY]: "1" } });

  // The same person back again, now with the worker running, and no hymn
  // opened yet: still the welcome page.
  const second = runEntry({ worker: true, stored: first.store });
  assert.equal(second.entry, "welcome");
  assert.equal(second.view, "welcome");
  assert.equal(second.store[RETURNING_KEY], undefined);

  // After they open a hymn the app marks them, and the bare address is the list.
  const third = runEntry({ worker: true, stored: { ...first.store, [RETURNING_KEY]: "1" } });
  assert.equal(third.entry, "hymns");
  assert.equal(third.view, undefined);

  // Someone who used Hark before the welcome page existed has a worker
  // running and neither mark. They are not shown it, now or later.
  const existing = runEntry({ worker: true });
  assert.equal(existing.entry, "hymns");
  assert.equal(existing.view, undefined);
  assert.deepEqual(existing.store, { [RETURNING_KEY]: "1" });
  assert.equal(runEntry({ worker: false, stored: existing.store }).entry, "hymns");

  // The installed app always opens on the hymns, on its very first launch too.
  const installed = runEntry({ installed: true });
  assert.equal(installed.entry, "hymns");
  assert.equal(installed.view, undefined);
  assert.equal(installed.store[RETURNING_KEY], "1");
  assert.equal(runEntry({ installed: true, stored: { [NEWCOMER_KEY]: "1" } }).entry, "hymns");

  // A deep link is never redirected, whoever follows it.
  for (const hash of ["#/", "#/number", "#/title", "#/author", "#/themes", "#/theme/advent", "#/sins", "#/requests", "#/comments", "#/install", "#/hymn/203"]) {
    assert.equal(runEntry({ hash }).view, undefined, hash);
  }
  // The welcome page has its own address, open to anyone.
  assert.equal(runEntry({ hash: "#/welcome", installed: true }).view, "welcome");
  assert.equal(runEntry({ hash: "#/welcome", stored: { [RETURNING_KEY]: "1" } }).view, "welcome");
  assert.equal(runEntry({ hash: "#" }).view, "welcome");

  // Storage that throws, or a browser with no workers, does not break it.
  assert.equal(runEntry({ storage: "blocked" }).entry, "welcome");
  assert.equal(runEntry({ storage: "blocked", worker: true }).entry, "hymns");
  assert.equal(runEntry({ storage: "blocked", installed: true }).entry, "hymns");
  assert.equal(runEntry({ worker: null }).entry, "welcome");

  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  // The script that sets data-installed runs before the one that reads it.
  assert.ok(page.indexOf("dataset.installed = \"true\"") < page.indexOf('<script id="entry-script">'));
  assert.ok(page.indexOf('<script id="entry-script">') < page.indexOf('<link rel="stylesheet"'));
  assert.ok(page.includes(`"${RETURNING_KEY}"`) && page.includes(`"${NEWCOMER_KEY}"`));
  assert.match(page, /<a class="about-link" id="about-link" href="#\/welcome">About Hark<\/a>/);
});

test("the app routes the welcome page and leaves every other route alone", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const routeSource = appSource.slice(appSource.indexOf("function route()"), appSource.indexOf("function indexHref("));

  // The bare address follows the choice made in index.html. "#/" is the list.
  assert.match(appSource, /const opensOnWelcome = document\.documentElement\.dataset\.entry === "welcome";/);
  assert.match(routeSource, /if \(\(hash === "" \|\| hash === "#"\) && opensOnWelcome\) return \{ view: "welcome" \};/);
  assert.match(routeSource, /if \(path === "\/welcome"\) return \{ view: "welcome" \};/);
  for (const line of [
    'if (path === "/" || path === "/number") return { view: "index", index: "number" };',
    'if (path === "/title") return { view: "index", index: "title" };',
    'if (path === "/author") return { view: "index", index: "author" };',
    'if (path === "/themes") return { view: "themes" };',
    'if (path === "/sins") return { view: "sins" };',
    'if (path === "/requests") return { view: "requests" };',
    'if (path === "/install") return { view: "install" };',
    'location.replace("#/requests");',
    "/^\\/theme\\/([a-z0-9-]+)\\/?$/",
    "/^\\/hymn\\/(\\d+)\\/?$/",
  ]) {
    assert.ok(routeSource.includes(line), line);
  }

  // Opening a hymn is what marks a reader as returning.
  const hymnSource = appSource.slice(appSource.indexOf("function renderHymn("), appSource.indexOf("function requestField("));
  assert.match(hymnSource, /markReturning\(\);/);
  assert.match(appSource, /localStorage\.setItem\(RETURNING_KEY, "1"\)/);
  // Back from a hymn opened on the welcome page returns there.
  assert.match(appSource, /if \(index === "welcome"\) return "#\/welcome";/);
  assert.match(hymnSource, /\["Welcome", "welcome page"\]/);

  // The welcome page is drawn before the hymnal has loaded, and filled in after.
  assert.match(appSource, /if \(!ready\) \{[\s\S]*?if \(current\.view === "welcome"\) \{\s*renderWelcome\(\);/);
  assert.match(appSource, /if \(ready\) fillWelcome\(page\);/);
  // The Install button uses the same handler as the header link, and is not
  // offered inside the installed app.
  assert.match(appSource, /install\.addEventListener\("click", installClick\)/);
  assert.match(appSource, /installLink\.addEventListener\("click", installClick\)/);
  assert.match(appSource, /if \(!runningAsApp\(\)\) \{\s*const install = el\("a", \{ class: "btn btn-install", href: "#\/install" \}/);
  // The mark is decorative. The card is a real link with the hymn title as its name.
  assert.match(appSource, /src: "favicon\.svg", width: "56", height: "56", alt: "" \}/);
  assert.match(appSource, /el\("a", \{ href: `#\/hymn\/\$\{hymn\.number\}` \}, hymn\.title\)/);

  // It works offline: the new module and the mark it shows are precached.
  assert.ok(sw.includes('"./welcome.js"'));
  assert.ok(sw.includes('"./favicon.svg"'));
  assert.match(sw, /const CACHE = "hark-v\d+";/);
  // No new fonts, images, or outside addresses came with it.
  const welcomeSource = readFileSync(new URL("../welcome.js", import.meta.url), "utf8");
  assert.equal(/https?:\/\//.test(welcomeSource), false);
  const welcomeCss = css.slice(css.indexOf("/* Welcome page */"));
  assert.equal(/url\(/.test(welcomeCss), false);
  assert.equal(/@font-face|@import/.test(welcomeCss), false);
  // The search box and tabs are hidden by the stylesheet from the first paint.
  assert.match(css, /html\[data-view="welcome"\] \.search,[\s\S]*?html\[data-view="welcome"\] \.count-row \{\s*display: none;/);
  assert.match(css, /--paper: #f3eee4;/);
});

function memoryLikes() {
  const bag = new Map();
  return {
    getItem(key) {
      return bag.has(key) ? bag.get(key) : null;
    },
    setItem(key, value) {
      bag.set(key, String(value));
    },
  };
}

test("a like toggles and stays in storage", () => {
  const storage = memoryLikes();
  assert.equal(isLiked(203, storage), false);
  assert.deepEqual(likeButtonState(false), {
    pressed: false,
    label: "Like this hymn",
    text: "Like",
  });

  const liked = toggleLike(203, storage);
  assert.equal(liked.liked, true);
  assert.deepEqual(liked.likes, [203]);
  assert.equal(isLiked(203, storage), true);
  assert.deepEqual(likeButtonState(true), {
    pressed: true,
    label: "Unlike this hymn",
    text: "Liked",
  });

  // A later read of the same store still has the hymn.
  assert.deepEqual(readLikes(storage), [203]);
  toggleLike(15, storage);
  toggleLike(108, storage);
  assert.deepEqual(readLikes(storage), [15, 108, 203]);

  const removed = toggleLike(203, storage);
  assert.equal(removed.liked, false);
  assert.deepEqual(readLikes(storage), [15, 108]);
  assert.deepEqual(
    likedHymns(
      [
        { number: 203, title: "Hark" },
        { number: 15, title: "Stand Up" },
        { number: 999, title: "Missing" },
      ],
      storage,
    ).map((hymn) => hymn.number),
    [15],
  );

  storage.setItem("hark-likes", "not json");
  assert.deepEqual(readLikes(storage), []);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /aria-pressed/);
  assert.match(appSource, /aria-label", state\.label/);
  assert.match(appSource, /type: "button", class: "like-btn"/);
  assert.match(appSource, /No liked songs yet/);
  assert.match(appSource, /path === "\/liked"/);
});

test("the changelog lists hymns that are in the book, newest first", () => {
  const changelog = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8"));
  const hymns = JSON.parse(readFileSync(new URL("../data/hymns.json", import.meta.url), "utf8"));
  const numbers = new Set(hymns.map((hymn) => hymn.number));
  assert.ok(Array.isArray(changelog) && changelog.length > 0);
  let previous = "9999-99-99";
  const seen = new Set();
  for (const entry of changelog) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.date <= previous, entry.date);
    previous = entry.date;
    assert.ok(Array.isArray(entry.hymns));
    if (entry.hymns.length === 0) {
      assert.equal(typeof entry.note, "string");
      assert.ok(entry.note.trim().length > 0);
      assert.equal(/\u2013|\u2014/.test(entry.note), false, entry.note);
      continue;
    }
    assert.equal(new Set(entry.hymns).size, entry.hymns.length);
    for (const number of entry.hymns) {
      assert.equal(typeof number, "number", String(number));
      assert.equal(numbers.has(number), true, String(number));
      assert.equal(seen.has(number), false, String(number));
      seen.add(number);
    }
    if ("note" in entry) {
      assert.equal(typeof entry.note, "string");
      assert.ok(entry.note.trim().length > 0);
      assert.equal(/\u2013|\u2014/.test(entry.note), false, entry.note);
    }
  }
  assert.equal(seen.size, hymns.length);
  assert.equal(changelogDateLabel("2026-11-16"), "November 16, 2026");
  const groups = groupChangelog(changelog);
  assert.equal(groups[0].date, changelog[0].date);
  assert.equal(groups[0].batches.length, changelog.filter((entry) => entry.date === groups[0].date).length);
  assert.deepEqual(
    groups.flatMap((group) => group.batches),
    changelog,
  );
});

test("the RSS feed is generated from the changelog", () => {
  const changelog = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8"));
  const hymns = JSON.parse(readFileSync(new URL("../data/hymns.json", import.meta.url), "utf8"));
  const xml = buildFeed({ changelog, hymns });
  const onDisk = readFileSync(new URL("../feed.xml", import.meta.url), "utf8");
  assert.equal(onDisk, xml);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /<title>Hark<\/title>/);
  assert.ok(xml.includes(`${SITE}feed.xml`));
  assert.ok(xml.includes("Whate'er My God Ordains Is Right"));
  assert.equal(/\u2013|\u2014/.test(xml), false);
  const withHymns = changelog.filter((entry) => entry.hymns.length > 0);
  const first = hymns.find((hymn) => hymn.number === withHymns[0].hymns[0]).title;
  const last = hymns.find((hymn) => hymn.number === withHymns[withHymns.length - 1].hymns[0]).title;
  assert.ok(xml.indexOf(first) < xml.indexOf(last));
  const escaped = buildFeed({
    changelog: [{ date: "2026-11-17", hymns: [1], note: "A & B" }],
    hymns: [{ number: 1, title: "Grace & Peace" }],
  });
  assert.match(escaped, /Grace &amp; Peace/);
  assert.match(escaped, /A &amp; B/);
  assert.equal(escaped.includes("Grace & Peace"), false);
  assert.match(escaped, /<guid isPermaLink="false">/);

  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(page, /<link rel="alternate" type="application\/rss\+xml" title="Hark" href="feed\.xml">/);
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /path === "\/whats-new"/);
  assert.match(appSource, /Subscribe \(RSS\)/);
  assert.match(appSource, /#\/whats-new/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /const CACHE = "hark-v42";/);
  assert.ok(sw.includes('"./changelog.js"'));
  assert.ok(sw.includes('"./data/changelog.json"'));
  assert.ok(sw.includes('"./feed.xml"'));
  const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.ok(workflow.indexOf("node scripts/build-feed.mjs") < workflow.indexOf("rsync"));
  assert.ok(workflow.indexOf("actions/deploy-pages") < workflow.indexOf("scripts/notify-push.mjs"));
  const docs = readFileSync(new URL("../docs/data.md", import.meta.url), "utf8");
  assert.match(docs, /Every hymn addition must append a `changelog\.json` entry/);
  assert.match(docs, /Monday bulletin routine/);
});

test("a notice reads like 3 new hymns from Sunday's services", () => {
  assert.equal(
    pushNotice({ hymns: [15, 31, 34], note: "From Sunday's services" }),
    "3 new hymns from Sunday's services",
  );
  assert.equal(pushNotice({ hymns: [15], note: "From Sunday's services" }), "1 new hymn from Sunday's services");
  assert.equal(pushNotice({ hymns: [15, 31] }), "2 new hymns");
  assert.equal(
    pushNotice({ hymns: [15], note: "Hymns the congregation sings." }),
    "1 new hymn. Hymns the congregation sings.",
  );
  const older = { date: "2026-11-16", hymns: [15], note: "Initial collection" };
  const newer = { date: "2026-11-17", hymns: [31, 34, 56], note: "From Sunday's services" };
  assert.deepEqual(entriesToAnnounce([older, newer], [older], true), [newer]);
  assert.deepEqual(entriesToAnnounce([older, newer], [], false), []);
  assert.equal(/\u2013|\u2014/.test(pushNotice(newer)), false);
});

test("push ciphertext round trips, and an iPhone is told to install first", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const notice = "3 new hymns from Sunday's services";
  const body = await encryptPayload(notice, publicBytes, auth);
  const plain = await decryptPayload(body, pair.privateKey, publicBytes, auth);
  assert.equal(new TextDecoder().decode(plain), notice);
  assert.equal(body[20], 65);

  const iphone = {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    standalone: false,
    serviceWorker: true,
    pushManager: true,
    notification: true,
  };
  assert.match(pushBlockReason(iphone), /Home Screen/);
  assert.equal(pushBlockReason({ ...iphone, standalone: true }), "");
  assert.match(pushBlockReason({ ...iphone, standalone: true, pushManager: false }), /16\.4/);
  assert.match(
    pushBlockReason({ userAgent: "Mozilla/5.0", serviceWorker: false, pushManager: false, notification: false }),
    /cannot show notifications/,
  );
  assert.equal(pushOpen(), true);
  assert.equal(pushOpen({ endpoint: "", vapidPublicKey: pushConfig.vapidPublicKey }), false);
  assert.equal(urlBase64ToBytes(pushConfig.vapidPublicKey).length, 65);

  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /#\/whats-new/);
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /Notify me/);
  assert.match(appSource, /Stop notifications/);
  assert.match(appSource, /\/subscribe/);
  assert.match(appSource, /\/unsubscribe/);
});

test("the worker stores a subscription and sends the notice", async () => {
  const saved = new Map();
  const store = {
    async get(key) {
      return saved.has(key) ? saved.get(key) : null;
    },
    async put(key, value) {
      saved.set(key, value);
    },
    async delete(key) {
      saved.delete(key);
    },
    async list() {
      return { keys: [...saved.keys()].map((name) => ({ name })), list_complete: true };
    },
  };
  const subscriber = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", subscriber.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const vapid = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", vapid.privateKey);
  const vapidPublic = new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey));
  const subscription = {
    endpoint: "https://push.example/send/abc",
    keys: { p256dh: bytesToBase64Url(publicBytes), auth: bytesToBase64Url(auth) },
  };
  const gone = {
    endpoint: "https://push.example/gone",
    keys: subscription.keys,
  };
  const originalFetch = globalThis.fetch;
  const pushes = [];
  globalThis.fetch = async (url, options) => {
    pushes.push({ url: String(url), options });
    if (String(url).endsWith("/gone")) return new Response("", { status: 410 });
    return new Response("", { status: 201 });
  };
  try {
    const worker = await import(`../worker/src/index.js?push=${Date.now()}`);
    const env = {
      ALLOWED_ORIGIN: "https://hark.theweightofglory.com",
      PUSH_SUBSCRIPTIONS: store,
      PUSH_NOTIFY_SECRET: "test-secret",
      VAPID_PRIVATE_JWK: JSON.stringify(jwk),
      VAPID_PUBLIC_KEY: bytesToBase64Url(vapidPublic),
      VAPID_SUBJECT: "mailto:hark@example.com",
    };
    const origin = { origin: "https://hark.theweightofglory.com", "content-type": "application/json" };
    const post = (path, body, headers = origin) =>
      worker.default.fetch(
        new Request(`https://hark-requests.example${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        env,
      );
    assert.equal((await post("/subscribe", { hello: true })).status, 400);
    assert.equal((await post("/subscribe", subscription, { "content-type": "application/json" })).status, 403);
    assert.equal((await post("/subscribe", subscription)).status, 200);
    assert.equal(saved.size, 1);
    assert.equal((await post("/notify", { hymns: [1, 2, 3], note: "From Sunday's services" }, {
      "content-type": "application/json",
      authorization: "Bearer wrong",
    })).status, 401);
    const notified = await post("/notify", {
      date: "2026-11-17",
      hymns: [15, 31, 34],
      note: "From Sunday's services",
    }, {
      "content-type": "application/json",
      authorization: "Bearer test-secret",
    });
    assert.equal(notified.status, 200);
    assert.equal((await notified.json()).sent, 1);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].options.headers["content-encoding"], "aes128gcm");
    assert.match(pushes[0].options.headers.authorization, /^vapid t=/);
    const bytes = pushes[0].options.body instanceof Uint8Array
      ? pushes[0].options.body
      : new Uint8Array(await new Response(pushes[0].options.body).arrayBuffer());
    const message = JSON.parse(new TextDecoder().decode(await decryptPayload(bytes, subscriber.privateKey, publicBytes, auth)));
    assert.equal(message.title, "Hark");
    assert.equal(message.body, "3 new hymns from Sunday's services");
    assert.equal(message.url, "/#/whats-new");

    assert.equal((await post("/subscribe", gone)).status, 200);
    pushes.length = 0;
    const expired = await post("/notify", { hymns: [15], note: "From Sunday's services" }, {
      "content-type": "application/json",
      authorization: "Bearer test-secret",
    });
    const expiredBody = await expired.json();
    assert.equal(expiredBody.sent, 1);
    assert.equal(expiredBody.removed, 1);
    assert.equal(saved.size, 1);

    assert.equal((await post("/unsubscribe", { endpoint: subscription.endpoint })).status, 200);
    assert.equal(saved.size, 0);

    const closed = await worker.default.fetch(
      new Request("https://hark-requests.example/notify", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer test-secret" },
        body: JSON.stringify({ hymns: [15] }),
      }),
      { ...env, PUSH_NOTIFY_SECRET: "" },
    );
    assert.equal(closed.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("play all keeps caption ends and every song still stops", () => {
  const counts = {};
  for (const def of [...themes.seasons, ...themes.topics]) {
    counts[def.id] = themeTracks({ hymns, themes, recordings, themeId: def.id }).length;
  }
  assert.equal(counts.christmas, 20);
  assert.equal(counts.advent, 5);
  assert.equal(counts.epiphany, 4);
  assert.equal(counts["all-year"], 49);
  const christmas = themeTracks({ hymns, themes, recordings, themeId: "christmas" });
  assert.ok(christmas.every((track) => track.trustworthy && track.end > track.start));
  assert.equal(new Set(christmas.map((track) => track.number)).size, christmas.length);

  const shepherd = faithRecordings(recordings, 86)[0];
  assert.equal(captionEnd(shepherd), 860);
  const known = playbackStop(shepherd, byNumber.get(86));
  assert.equal(known.trustworthy, true);
  assert.equal(known.at, 860);

  const bare = playbackStop({ start: 10, id: "abcdefghijk" }, { stanzas: [["a"], ["b"]] });
  assert.equal(bare.trustworthy, false);
  assert.equal(bare.at, estimatedEnd(10, 2));
  assert.equal(bare.at, 10 + 12 + 80);
  assert.ok(bare.at < known.at);

  const shuffled = shuffleTracks(christmas, () => 0);
  assert.equal(shuffled.length, christmas.length);
  assert.equal(shuffled[0], christmas[1]);
  assert.deepEqual(shuffled.slice(1, -1), christmas.slice(2));
  assert.equal(shuffled[shuffled.length - 1], christmas[0]);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /function playAllControls/);
  assert.match(appSource, /Play all/);
  assert.match(appSource, /playAllControls\(feature\.theme\.id\)/);
  assert.match(appSource, /playAllControls\(selectedThemeId\(\)\)/);
  assert.match(appSource, /playAllControls\(group\.id\)/);
  assert.match(appSource, /updateViaCache: "none"/);
  assert.match(appSource, /registration\.update\(\)/);
  assert.match(appSource, /visibilitychange/);
  assert.match(appSource, /hark-sw-reload/);
  assert.match(appSource, /getCurrentTime/);
  assert.match(appSource, /endSeconds: track\.end/);
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(page, /id="song-bar"/);
  assert.match(page, /Keep watching the service/);
  assert.match(page, /aria-label="Play next song"/);
  assert.match(page, />Play next song</);
  assert.equal(/\u2013|\u2014/.test(page), false);

  const book = songsWithEndings({
    hymns: [
      { number: 1, title: "One", stanzas: [["a"]] },
      { number: 2, title: "Two", stanzas: [["b"]] },
      { number: 4, title: "Four", stanzas: [["c"]] },
    ],
    recordings: {
      1: [{
        url: "https://www.youtube.com/watch?v=abcdefghijk&t=10s",
        start_seconds: 10,
        end_seconds: 40,
        end_source: "captions",
        video_date: "2026-01-01",
        label: "One",
      }],
      2: [{
        url: "https://www.youtube.com/watch?v=bcdefghijkl&t=5s",
        start_seconds: 5,
        video_date: "2026-01-02",
        label: "Two",
      }],
      4: [{
        url: "https://www.youtube.com/watch?v=cdefghijklm&t=8s",
        start_seconds: 8,
        end_seconds: 50,
        end_source: "captions",
        video_date: "2026-01-03",
        label: "Four",
      }],
    },
  });
  assert.deepEqual(book.map((track) => track.number), [1, 4]);
  assert.equal(nextEndingSong(book, 1, { wrap: false }).number, 4);
  assert.equal(nextEndingSong(book, 4, { wrap: false }), null);
  assert.equal(nextEndingSong(book, 4, { wrap: true }).number, 1);
  assert.match(appSource, /Auto play all/);
  assert.match(appSource, /hark-auto-play-all/);
  assert.match(appSource, /nextPlay\(\{/);
  assert.match(appSource, /function listPlayControls/);
  assert.match(appSource, /listWithPlay\(numberList\(result\.hymns\), result\.hymns\)/);
  assert.match(appSource, /listWithPlay\(titleList\(result\.letters\), shown\)/);
  assert.match(appSource, /listWithPlay\(authorList\(result\.letters\), shown\)/);
  assert.match(appSource, /listWithPlay\(numberList\(list\), list\)/);
  assert.match(appSource, /hymnPlayControls\(hymn\)/);
});

test("a song started outside a theme continues through the book", () => {
  const catalog = songsWithEndings({ hymns, recordings });
  assert.ok(catalog.length > 5);
  const started = nextPlay({ catalog, queue: [catalog[0]], index: 0, auto: true });
  assert.equal(started.number, catalog[1].number);
  const wrapped = nextPlay({
    catalog,
    queue: [catalog[catalog.length - 1]],
    index: 0,
    auto: true,
  });
  assert.equal(wrapped.number, catalog[0].number);
  assert.equal(
    nextPlay({
      catalog,
      queue: [catalog[catalog.length - 1]],
      index: 0,
      auto: false,
      singleAdvance: true,
    }),
    null,
  );
  const picked = [catalog[3], catalog[1], catalog[5]].map((track) => byNumber.get(track.number));
  const listed = tracksForHymns({ hymns: picked, recordings });
  assert.deepEqual(
    listed.map((track) => track.number),
    picked.map((hymn) => hymn.number),
  );
  const fromSearch = nextPlay({ catalog, queue: listed, index: 0, auto: true });
  assert.equal(fromSearch.number, nextEndingSong(catalog, listed[0].number, { wrap: true }).number);
  assert.notEqual(fromSearch.number, listed[1].number);
  const kept = nextPlay({ catalog, queue: listed, index: 0, auto: false });
  assert.equal(kept.number, listed[1].number);
  const fromHere = songsFromNumber(catalog, listed[0].number);
  assert.equal(fromHere[0].number, listed[0].number);
  assert.ok(fromHere.every((track) => track.number >= listed[0].number));
  assert.ok(fromHere.length < catalog.length);
});

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { requestConfig, requestsOpen } from "../config/requests.js";
import { INSTALL_URL, installGuide } from "../install.js";
import {
  authorIndex,
  browse,
  classifyRecording,
  faithRecordings,
  filterHymns,
  formatRecordingDate,
  gapNote,
  isWithheld,
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
  listSermons,
} from "../hymn-model.js";

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
  assert.equal(hymns.length, 45);
  assert.deepEqual(
    hymns.map((hymn) => hymn.number),
    [
      108, 162, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208,
      209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226,
      227, 228, 229, 230, 231, 232, 233, 401, 559,
    ],
  );
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
    [212, 230, 231, 232],
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
  assert.ok(titleSortKey("The First Noel") < titleSortKey("Thou Who Wast Rich"));
  assert.equal(titleLetter("Hark! The Herald Angels Sing"), "H");
  assert.deepEqual(
    browse(hymns, { mode: "title" }).letters.flatMap((bucket) =>
      bucket.hymns.map((hymn) => hymn.number),
    ),
    [
      217, 219, 401, 218, 214, 226, 204, 205, 206, 209, 196, 197, 559, 220, 229, 224, 211, 207,
      203, 216, 200, 195, 193, 198, 221, 231, 208, 194, 232, 201, 202, 162, 227, 225, 228, 199,
      210, 230, 233, 213, 108, 215, 222, 223, 212,
    ],
  );
});

test("author index files people by surname and keeps translators", () => {
  const all = groups();
  assert.equal(all.length, 48);
  assert.deepEqual(group("Rodigast, Samuel").hymns.map((item) => item.hymn.number), [108]);
  assert.deepEqual(group("Ken, Thomas").hymns.map((item) => item.hymn.number), [401]);
  assert.deepEqual(group("Waring, Anna Laetitia").hymns.map((item) => item.hymn.number), [559]);
  assert.ok(all.every((item) => !/^mod\.?$/i.test(item.label)));
  assert.deepEqual(
    group("Neale, John Mason (tr.)").hymns.map((item) => item.hymn.number),
    [162, 194, 207],
  );
  assert.deepEqual(
    group("Watts, Isaac").hymns.map((item) => item.hymn.number),
    [195],
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
    [
      [196, null],
      [232, "tr."],
    ],
  );
  assert.equal(
    group("Anonymous").hymns.find((item) => item.hymn.number === 215).mark,
    "tr.",
  );
  assert.deepEqual(
    group("Winkworth, Catherine (tr.)").hymns.map((item) => item.hymn.number),
    [108, 197, 198, 217, 220],
  );
  const indexed = new Set(all.flatMap((item) => item.hymns.map((entry) => entry.hymn.number)));
  for (const hymn of hymns) assert.ok(indexed.has(hymn.number), String(hymn.number));
});

test("partial and withheld hymns describe what is missing", () => {
  const plan = stanzaPlan(byNumber.get(196));
  assert.deepEqual(
    plan.map((block) => (block.type === "stanza" ? block.number : block.note)),
    [1, "Stanzas 2 and 3 are omitted.", 4],
  );
  assert.match(partialNote(byNumber.get(196)), /^Stanzas 2 and 3 are by Mark E\. Hunt/);
  assert.equal(partialNote(byNumber.get(212)), null);
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
  assert.equal(around.prev.number, 202);
  assert.equal(around.next.number, 204);
  assert.equal(neighbors(hymns, 108).prev, null);
  assert.equal(neighbors(hymns, 162).prev.number, 108);
  assert.equal(neighbors(hymns, 233).next.number, 401);
  assert.equal(neighbors(hymns, 559).next, null);
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
  assert.deepEqual(hymnsInTheme(themes, "epiphany"), [206, 213, 218, 226, 228, 229]);
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
  assert.deepEqual(hymnsInTheme(themes, "all-year"), [108, 401, 559]);
});

test("Faith Presbyterian recordings stay out of the hymn file and sort newest first", () => {
  assert.equal(Object.keys(recordings).length, 30);
  assert.equal(Object.values(recordings).reduce((sum, items) => sum + items.length, 0), 134);
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
  assert.equal(faithRecordings(recordings, 211).length, 0);
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

test("install manifest, guide, and QR code", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Hark");
  assert.equal(manifest.short_name, "Hark");
  assert.equal(manifest.start_url, "/hark/");
  assert.equal(manifest.scope, "/hark/");
  assert.equal(manifest.id, "/hark/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#f3eee4");
  assert.equal(manifest.background_color, "#f3eee4");
  for (const size of ["192x192", "512x512"]) {
    for (const purpose of ["any", "maskable"]) {
      const icon = manifest.icons.find((item) => item.sizes === size && item.purpose === purpose);
      assert.ok(icon, `${size} ${purpose}`);
      assert.equal(icon.src.startsWith("/hark/icons/"), true);
      const file = icon.src.slice("/hark/".length);
      const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
      const width = bytes.readUInt32BE(16);
      assert.equal(width, Number(size.slice(0, 3)));
      assert.equal(bytes.readUInt32BE(20), width);
    }
  }
  const svg = readFileSync(new URL("../icons/hark-qr.svg", import.meta.url), "utf8");
  assert.equal(svg.startsWith("<svg"), true);
  assert.match(svg, new RegExp(INSTALL_URL.replace(/[.]/g, "\\.")));
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
  assert.match(sw, /hark-v12/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /clients\.claim\(\)/);
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
    "install.js",
    "config/requests.js",
    "worker/src/index.js",
    "sw.js",
    "manifest.webmanifest",
    "README.md",
    "docs/data.md",
    "docs/recordings.md",
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
  for (const file of files) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(/\u2013|\u2014/.test(text), false, file);
  }
});

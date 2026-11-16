import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  authorIndex,
  browse,
  classifyRecording,
  filterHymns,
  gapNote,
  isWithheld,
  listRecordings,
  listSections,
  neighbors,
  partialNote,
  stanzaPlan,
  titleLetter,
  titleSortKey,
} from "../hymn-model.js";

const hymns = JSON.parse(readFileSync(new URL("../data/hymns.json", import.meta.url), "utf8"));
const byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));

function groups() {
  return authorIndex(hymns).flatMap((bucket) => bucket.groups);
}

function group(label) {
  const found = groups().find((item) => item.label === label);
  assert.ok(found, label);
  return found;
}

test("loads the 42 Advent and Christmas hymns", () => {
  assert.equal(hymns.length, 42);
  assert.deepEqual(
    hymns.map((hymn) => hymn.number),
    [
      162, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209,
      210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227,
      228, 229, 230, 231, 232, 233,
    ],
  );
  assert.deepEqual(listSections(hymns), ["Advent", "Christmas"]);
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
      217, 219, 218, 214, 226, 204, 205, 206, 209, 196, 197, 220, 229, 224, 211, 207, 203, 216,
      200, 195, 193, 198, 221, 231, 208, 194, 232, 201, 202, 162, 227, 225, 228, 199, 210, 230,
      233, 213, 215, 222, 223, 212,
    ],
  );
});

test("author index files people by surname and keeps translators", () => {
  const all = groups();
  assert.equal(all.length, 45);
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
    [197, 198, 217, 220],
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
  assert.equal(neighbors(hymns, 162).prev, null);
  assert.equal(neighbors(hymns, 233).next, null);
  assert.equal(neighbors(hymns, 999).hymn, null);
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
    "sw.js",
    "manifest.webmanifest",
    "README.md",
    "docs/data.md",
    ".github/workflows/pages.yml",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(/\u2013|\u2014/.test(text), false, file);
  }
});

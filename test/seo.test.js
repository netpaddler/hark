import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { inHymnal } from "../hymn-model.js";
import { SITE, buildSeo, hymnPath, pageDescription, pageTitle, personName } from "../scripts/build-seo.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
const hymns = read("data/hymns.json");
const changelog = read("data/changelog.json");
const themes = read("data/themes.json");
const files = buildSeo({ hymns, changelog, themes });
const disk = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = (hymn) => disk(`${hymnPath(hymn)}index.html`);
const DASH = /[–—]/;

test("every hymn has a page on disk", () => {
  for (const hymn of hymns) assert.ok(existsSync(new URL(`../${hymnPath(hymn)}index.html`, import.meta.url)), `hymn ${hymn.number}`);
});

test("generated files are in sync with the data (run npm run build:seo)", () => {
  for (const [path, contents] of files) assert.equal(disk(path), contents, `${path} is out of date. Run npm run build:seo.`);
  const onDisk = readdirSync(new URL("../hymn/", import.meta.url));
  assert.deepEqual(onDisk.sort(), hymns.map((hymn) => String(hymn.number)).sort(), "hymn/ has a stale or missing folder");
});

test("sitemap lists the home page and every hymn page", () => {
  const xml = disk("sitemap.xml");
  assert.ok(xml.includes(`<loc>${SITE}</loc>`));
  for (const hymn of hymns) assert.ok(xml.includes(`<loc>${SITE}hymn/${hymn.number}/</loc>`), `hymn ${hymn.number}`);
  assert.equal((xml.match(/<loc>/g) || []).length, hymns.length + 1);
});

test("robots.txt allows all and names the sitemap", () => {
  const robots = disk("robots.txt");
  assert.match(robots, /User-agent: \*\nAllow: \//);
  assert.match(robots, new RegExp(`Sitemap: ${SITE}sitemap.xml`));
});

test("songs above 742 never mention the Trinity Hymnal", () => {
  const outside = hymns.filter((hymn) => !inHymnal(hymn));
  assert.ok(outside.length > 0);
  for (const hymn of outside) {
    assert.doesNotMatch(page(hymn), /trinity/i, `hymn ${hymn.number}`);
    assert.doesNotMatch(pageTitle(hymn), /hymnal/i);
  }
});

test("hymnal songs are titled with their hymnal number", () => {
  const hymn = hymns.find((item) => item.number === 578);
  assert.equal(pageTitle(hymn), "The Son of God Goes Forth to War | Trinity Hymnal 578 | Hark");
  assert.match(pageDescription(hymn), /Words: Reginald Heber/);
  assert.match(pageDescription(hymn), /Tune: ALL SAINTS NEW, Henry S. Cutler/);
  assert.doesNotMatch(pageDescription(hymns.find((item) => item.number === 5)), /\.\./);
});

test("copyrighted hymns carry no lyric lines", () => {
  const withheld = hymns.filter((hymn) => hymn.public_domain === false);
  assert.ok(withheld.length > 0);
  for (const hymn of withheld) {
    const html = page(hymn);
    assert.doesNotMatch(html, /class="line"/, `hymn ${hymn.number}`);
    assert.doesNotMatch(html, /Begins "/, `hymn ${hymn.number}`);
    assert.match(html, /under copyright/);
  }
});

test("every line printed on a page is a stored line of that hymn", () => {
  const unescape = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const hymn of hymns) {
    const stored = new Set([...(hymn.stanzas || []).flat(), ...(hymn.refrain || [])]);
    for (const match of page(hymn).matchAll(/<span class="line">(.*?)<\/span>/g)) {
      assert.ok(stored.has(unescape(match[1])), `hymn ${hymn.number}: ${match[1]}`);
    }
  }
});

test("each page has its own metadata, the app link, and analytics", () => {
  const titles = new Set();
  for (const hymn of hymns) {
    const html = page(hymn);
    const url = `${SITE}hymn/${hymn.number}/`;
    assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
    assert.match(html, new RegExp(`<meta property="og:url" content="${url}">`));
    assert.match(html, /<meta name="twitter:card"/);
    assert.match(html, /"@type": "MusicComposition"/);
    assert.match(html, new RegExp(`href="/#/hymn/${hymn.number}">Open in Hark<`));
    assert.match(html, /cloudflareinsights/);
    assert.match(html, /\/ga\.js/);
    assert.doesNotMatch(html, /http-equiv="refresh"|location\.(?:replace|href\s*=)/);
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    titles.add(title);
    assert.doesNotMatch(pageDescription(hymn), DASH);
    assert.doesNotMatch(title, DASH);
  }
});

test("structured data only names people, not sources", () => {
  assert.equal(personName("Louis Bourgeois (1551)"), "Louis Bourgeois");
  assert.equal(personName("Henry S. Cutler (1872)"), "Henry S. Cutler");
  assert.equal(personName("Greek hymn, 3rd cent. or earlier"), "");
  assert.equal(personName("Ancient Irish air, The Moreen"), "");
  assert.equal(personName("The Psalter (Psalm 22:23-26, 31)"), "");
});

test("the home page has search and share metadata", () => {
  const html = disk("index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/hark\.theweightofglory\.com\/">/);
  for (const tag of ["og:title", "og:description", "og:url", "og:image", "og:site_name"]) assert.ok(html.includes(`property="${tag}"`), tag);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, /"@type": "WebSite"/);
  assert.doesNotMatch(html.match(/<title>.*<\/title>/)[0], DASH);
  assert.ok(existsSync(new URL("../icons/share.png", import.meta.url)));
});

test("the service worker serves hymn pages, not the app shell", () => {
  const sw = disk("sw.js");
  assert.match(sw, /\\\/hymn\\\/\(\\d\+\)/);
});

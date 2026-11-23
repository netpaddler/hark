// Builds the search engine files: one static page per hymn under hymn/NNN/,
// sitemap.xml, and robots.txt. Run it with `npm run build:seo` whenever
// data/hymns.json or data/changelog.json changes. The output is committed, and
// test/seo.test.js fails when it is out of date.
//
// Every fact on a page comes from the data files. A hymn the Trinity Hymnal
// does not contain (number above 742) never names the hymnal. The words are
// printed only for public domain hymns, and only the stanzas the app stores.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  altTunes,
  attributionParts,
  inHymnal,
  isWithheld,
  neighbors,
  numberedTitle,
  partialNote,
  sortByNumber,
  stanzaPlan,
  themesForHymn,
  wordsPending,
} from "../hymn-model.js";

export const SITE = "https://hark.theweightofglory.com/";
export const SHARE_IMAGE = `${SITE}icons/share.png`;

export function hymnPath(hymn) {
  return `hymn/${hymn.number}/`;
}

export function hymnUrl(hymn, site = SITE) {
  return `${site}${hymnPath(hymn)}`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// JSON-LD sits inside a script tag, so a "<" must never end it early.
function jsonLd(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

// "Hail, Gladdening Light | Hark", or with the hymnal and number for a hymn
// that is in the Trinity Hymnal.
export function pageTitle(hymn) {
  return inHymnal(hymn) ? `${hymn.title} | Trinity Hymnal ${hymn.number} | Hark` : `${hymn.title} | Hark`;
}

function firstLine(hymn) {
  const lines = Array.isArray(hymn.stanzas) && hymn.stanzas[0] ? hymn.stanzas[0] : [];
  const line = lines.find((item) => typeof item === "string" && item.trim());
  if (!line) return "";
  return line
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/[,;:\s]+$/, "")
    .trim();
}

// Only a hymn with public words may quote them.
function quotedFirstLine(hymn) {
  if (isWithheld(hymn) || wordsPending(hymn)) return "";
  return firstLine(hymn);
}

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).replace(/[,;:\s]+$/, "")}...`;
}

export function pageDescription(hymn) {
  const parts = [];
  parts.push(inHymnal(hymn) ? `${hymn.title}, Trinity Hymnal ${hymn.number}.` : `${hymn.title}.`);
  const sentence = (text) => `${String(text).replace(/[.\s]+$/, "")}.`;
  const words = [];
  if (hymn.author) words.push(hymn.author);
  if (hymn.translator) words.push(`tr. ${hymn.translator}`);
  if (words.length) parts.push(sentence(`Words: ${words.join(", ")}`));
  const music = [];
  if (hymn.tune) music.push(hymn.tune);
  if (hymn.composer) music.push(hymn.composer);
  if (music.length) parts.push(sentence(`Tune: ${music.join(", ")}`));
  if (hymn.year_text) parts.push(sentence(hymn.year_text));
  const line = quotedFirstLine(hymn);
  if (line) parts.push(`Begins "${line}".`);
  parts.push("Read it on Hark with its story, Scripture, and recordings.");
  return clip(parts.join(" "), 300);
}

// Names that are really a source, a country, or a book, not a person. Those
// stay in the visible text but are left out of the structured data.
const NOT_A_PERSON =
  /\d|[,;:]|\b(?:hymn|psalm|psalms|psalter|psalmodia|melody|air|chant|folk|carol|anonymous|unknown|ancient|traditional|greek|latin|german|french|welsh|irish|scottish|english|genevan|hymnal|book|church)\b/i;

export function personName(value) {
  if (!value) return "";
  const name = String(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || NOT_A_PERSON.test(name)) return "";
  if (!/^[A-Z][\w.'’-]*(?: [A-Za-z][\w.'’-]*){1,4}$/.test(name)) return "";
  return name;
}

export function structuredData(hymn, site = SITE) {
  const url = hymnUrl(hymn, site);
  const work = {
    "@type": "MusicComposition",
    "@id": `${url}#song`,
    name: hymn.title,
    url,
    inLanguage: "en",
  };
  const lyricist = personName(hymn.author);
  if (lyricist) work.lyricist = { "@type": "Person", name: lyricist };
  const composer = personName(hymn.composer);
  if (composer) work.composer = { "@type": "Person", name: composer };
  if (hymn.tune) work.alternateName = `Tune: ${hymn.tune}`;
  if (inHymnal(hymn)) work.isPartOf = { "@type": "Book", name: "Trinity Hymnal" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      work,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Hark", item: site },
          { "@type": "ListItem", position: 2, name: hymn.title, item: url },
        ],
      },
    ],
  };
}

function wordsHtml(hymn) {
  if (isWithheld(hymn)) {
    const lines = ['<div class="notice copyright-notice">', "<h2>Words not shown here</h2>"];
    lines.push("<p>The words are under copyright, so they are not reproduced on this page.</p>");
    if (hymn.copyright_note) lines.push(`<p class="copyright-line">${esc(hymn.copyright_note)}</p>`);
    lines.push("</div>");
    return lines.join("\n");
  }
  if (wordsPending(hymn)) {
    return [
      '<div class="notice">',
      "<h2>Words not added yet</h2>",
      "<p>The words are still to come.</p>",
      "</div>",
    ].join("\n");
  }
  const out = [];
  const note = partialNote(hymn);
  if (note) out.push(`<div class="notice">\n<h2>Some stanzas are omitted</h2>\n<p>${esc(note)}</p>\n</div>`);
  const text = ['<div class="text">'];
  const lineSpans = (lines) => lines.map((line) => `<span class="line">${esc(line)}</span>`).join("");
  for (const block of stanzaPlan(hymn)) {
    if (block.type === "gap" || block.type === "copyright") {
      text.push(`<p class="${block.type === "copyright" ? "omitted copyright-stanza" : "omitted"}">${esc(block.note)}</p>`);
    } else if (block.type === "refrain") {
      text.push(
        `<div class="refrain"><p class="refrain-label">Refrain</p><p class="refrain-lines">${lineSpans(block.lines)}</p></div>`,
      );
    } else {
      text.push(
        `<div class="stanza"><p class="stanza-num"><span class="visually-hidden">Stanza </span>${block.number}</p><p class="stanza-lines">${lineSpans(block.lines)}</p></div>`,
      );
    }
  }
  text.push("</div>");
  out.push(text.join("\n"));
  return out.join("\n");
}

const PAGE_STYLE = `
      .site-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: 1rem 0 0.4rem; border-bottom: 1px solid var(--line); }
      .site-head .brand-home { font-size: 1.5rem; font-weight: 600; text-decoration: none; color: var(--ink); }
      .site-head .eyebrow { margin: 0; }
      .open-row { margin: 1.1rem 0 0.4rem; }
      .open-row .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; padding: 0 1.2rem; border: 1px solid var(--accent); border-radius: 999px; }
      .themes-line { margin: 0.5rem 0 0; color: var(--muted); font-size: 0.92rem; }
      .page-nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.6rem; padding-top: 0.9rem; border-top: 1px solid var(--line); }
      .page-nav a { color: var(--accent); font-weight: 600; text-decoration: none; }
`;

function analyticsScript(hymn) {
  return `    <script type="module">
      import { startAnalytics } from "/ga.js";
      startAnalytics();
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_title: document.title.slice(0, 100),
          page_location: location.href,
          page_path: location.pathname,
          hymn_number: ${hymn.number},
        });
      }
    </script>`;
}

export function hymnPage(hymn, { hymns, themes, site = SITE }) {
  const title = pageTitle(hymn);
  const description = pageDescription(hymn);
  const url = hymnUrl(hymn, site);
  const credit = attributionParts(hymn);
  const found = neighbors(hymns, hymn.number);
  const themeTitles = themesForHymn(themes, hymn.number).map((item) => item.title);
  const meta = [];
  if (hymn.year_text) meta.push(`<p class="attribution">${esc(hymn.year_text)}</p>`);
  const nav = [];
  const link = (item, label) => `<a href="/${hymnPath(item)}">${label}${esc(numberedTitle(item))}</a>`;
  if (found.prev) nav.push(link(found.prev, "Previous: "));
  if (found.next) nav.push(link(found.next, "Next: "));
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(url)}">
    <meta name="theme-color" content="#f3eee4">
    <meta name="color-scheme" content="light dark">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Hark">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:image" content="${esc(SHARE_IMAGE)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Hark">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(SHARE_IMAGE)}">
    <script type="application/ld+json">
${jsonLd(structuredData(hymn, site))}
    </script>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem("hark-theme");
          var theme = stored === "light" || stored === "dark"
            ? stored
            : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          document.documentElement.dataset.theme = theme;
        } catch (e) {}
      })();
    </script>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/icons/favicon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="preload" href="/fonts/newsreader-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/newsreader-600.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/styles.css">
    <style>${PAGE_STYLE}    </style>
  </head>
  <body>
    <div class="app">
      <header class="site-head">
        <a class="brand-home" href="/" aria-label="Hark home">Hark</a>
        <p class="eyebrow">Timeless songs of grace</p>
      </header>
      <main id="main">
        <article class="hymn">
${inHymnal(hymn) ? `          <p class="hymn-number">No. ${hymn.number}</p>\n` : ""}          <h1 class="hymn-title">${esc(hymn.title)}</h1>
${credit.people ? `          <p class="attribution">${esc(credit.people)}</p>\n` : ""}${credit.music ? `          <p class="attribution">${esc(credit.music)}</p>\n` : ""}${meta.map((line) => `          ${line}\n`).join("")}${themeTitles.length ? `          <p class="themes-line">Themes: ${esc(themeTitles.join(", "))}</p>\n` : ""}          <p class="open-row"><a class="btn btn-primary" href="/#/hymn/${hymn.number}">Open in Hark</a></p>
${wordsHtml(hymn)}
${nav.length ? `          <nav class="page-nav" aria-label="More hymns">${nav.join("")}</nav>\n` : ""}${inHymnal(hymn) ? `          <p class="colophon">Trinity Hymnal, 1990</p>\n` : ""}        </article>
      </main>
    </div>
${analyticsScript(hymn)}
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "567430717ceb466babf1905d0b1cd19a"}'></script>
  </body>
</html>
`;
}

// The newest changelog date that lists this hymn, or "" when none does.
function lastModified(changelog, number) {
  let best = "";
  for (const entry of changelog) {
    if (!entry || typeof entry.date !== "string" || !Array.isArray(entry.hymns)) continue;
    if (entry.hymns.includes(number) && entry.date > best) best = entry.date;
  }
  return best;
}

export function buildSitemap({ hymns, changelog, site = SITE }) {
  const dates = changelog.map((entry) => entry && entry.date).filter((date) => typeof date === "string");
  const newest = dates.sort().pop() || "";
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const add = (loc, lastmod) => {
    lines.push("  <url>");
    lines.push(`    <loc>${esc(loc)}</loc>`);
    if (lastmod) lines.push(`    <lastmod>${esc(lastmod)}</lastmod>`);
    lines.push("  </url>");
  };
  add(site, newest);
  for (const hymn of sortByNumber(hymns)) add(hymnUrl(hymn, site), lastModified(changelog, hymn.number));
  lines.push("</urlset>", "");
  return lines.join("\n");
}

export function buildRobots(site = SITE) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`;
}

// Every generated file, as a Map of repository path to contents.
export function buildSeo({ hymns, changelog, themes, site = SITE }) {
  const files = new Map();
  for (const hymn of hymns) {
    const html = hymnPage(hymn, { hymns, themes, site });
    // A song outside the hymnal must never name it, anywhere on its page.
    if (!inHymnal(hymn) && /trinity/i.test(html)) {
      throw new Error(`Hymn ${hymn.number} is not in the Trinity Hymnal but its page mentions it.`);
    }
    files.set(`${hymnPath(hymn)}index.html`, html);
  }
  files.set("sitemap.xml", buildSitemap({ hymns, changelog, site }));
  files.set("robots.txt", buildRobots(site));
  return files;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const read = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));
  const files = buildSeo({
    hymns: read("data/hymns.json"),
    changelog: read("data/changelog.json"),
    themes: read("data/themes.json"),
  });
  rmSync(join(root, "hymn"), { recursive: true, force: true });
  for (const [path, contents] of files) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  console.log(`Wrote ${files.size - 2} hymn pages, sitemap.xml, and robots.txt.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

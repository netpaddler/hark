import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { changelogDateLabel, changelogPubDate } from "../changelog.js";
import { numberedTitle } from "../hymn-model.js";

export const SITE = "https://hark.theweightofglory.com/";

function xml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemDescription(entry, byNumber, site) {
  const parts = [];
  if (entry.note) parts.push(`<p>${xml(entry.note)}</p>`);
  const items = [];
  for (const number of entry.hymns) {
    const hymn = byNumber.get(number);
    if (!hymn) continue;
    const href = `${site}#/hymn/${hymn.number}`;
    items.push(`<li><a href="${xml(href)}">${xml(numberedTitle(hymn))}</a></li>`);
  }
  if (items.length) parts.push(`<ul>${items.join("")}</ul>`);
  return parts.join("");
}

export function buildFeed({ changelog, hymns, site = SITE }) {
  const byNumber = new Map((hymns || []).map((hymn) => [hymn.number, hymn]));
  const entries = Array.isArray(changelog) ? changelog : [];
  const newest = entries.find((entry) => typeof entry?.date === "string");
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Hark</title>",
    `    <link>${xml(site)}</link>`,
    `    <atom:link href="${xml(`${site}feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    "    <description>Hymns added to Hark.</description>",
    "    <language>en</language>",
  ];
  if (newest) lines.push(`    <lastBuildDate>${xml(changelogPubDate(newest.date))}</lastBuildDate>`);
  for (const entry of entries) {
    if (!entry || typeof entry.date !== "string" || !Array.isArray(entry.hymns)) continue;
    const label = changelogDateLabel(entry.date);
    const title = entry.note || `Hymns added on ${label}`;
    const first = entry.hymns[0];
    lines.push("    <item>");
    lines.push(`      <title>${xml(title)}</title>`);
    lines.push(`      <link>${xml(`${site}#/whats-new`)}</link>`);
    lines.push(`      <guid isPermaLink="false">${xml(`${site}#/whats-new/${entry.date}/${first}`)}</guid>`);
    lines.push(`      <pubDate>${xml(changelogPubDate(entry.date))}</pubDate>`);
    const html = itemDescription(entry, byNumber, site).replace(/]]>/g, "]]&gt;");
    lines.push(`      <description><![CDATA[${html}]]></description>`);
    lines.push("    </item>");
  }
  lines.push("  </channel>");
  lines.push("</rss>");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const changelog = JSON.parse(readFileSync(join(root, "data/changelog.json"), "utf8"));
  const hymns = JSON.parse(readFileSync(join(root, "data/hymns.json"), "utf8"));
  writeFileSync(join(root, "feed.xml"), buildFeed({ changelog, hymns }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

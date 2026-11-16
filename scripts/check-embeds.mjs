// Reports YouTube videos in data/*.json whose watch page says playableInEmbed is false.
// Usage: node scripts/check-embeds.mjs

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const idPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/g;
const ids = new Set();

for (const name of readdirSync(dataDir)) {
  if (!name.endsWith(".json")) continue;
  const text = readFileSync(join(dataDir, name), "utf8");
  for (const match of text.matchAll(idPattern)) ids.add(match[1]);
}

function playableInEmbed(html) {
  const match = html.match(/"playableInEmbed"\s*:\s*(true|false)/);
  if (!match) return null;
  return match[1] === "true";
}

const blocked = [];
const unknown = [];

for (const id of [...ids].sort()) {
  const response = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; HarkEmbedCheck/1.0)",
      "accept-language": "en",
    },
  });
  if (!response.ok) {
    unknown.push(`${id} (HTTP ${response.status})`);
    continue;
  }
  const flag = playableInEmbed(await response.text());
  if (flag === false) blocked.push(id);
  else if (flag == null) unknown.push(id);
}

console.log(`Checked ${ids.size} YouTube videos.`);
if (blocked.length) {
  console.log("playableInEmbed is false:");
  for (const id of blocked) console.log(id);
} else {
  console.log("Every video can be embedded.");
}
if (unknown.length) {
  console.log("Could not read playableInEmbed:");
  for (const id of unknown) console.log(id);
}

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { entriesToAnnounce } from "../worker/src/push-notice.js";

function previousChangelog(sha) {
  if (!sha || /^0+$/.test(sha)) return { entries: [], known: false };
  try {
    const text = execFileSync("git", ["show", `${sha}:data/changelog.json`], { encoding: "utf8" });
    const entries = JSON.parse(text);
    return { entries: Array.isArray(entries) ? entries : [], known: true };
  } catch {
    return { entries: [], known: false };
  }
}

async function announce(entry, url, secret) {
  let cursor = "";
  do {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        date: entry.date,
        hymns: entry.hymns,
        note: entry.note || "",
        cursor,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`notify failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    const data = await response.json();
    cursor = data && data.done ? "" : (data && data.cursor) || "";
  } while (cursor);
}

async function main() {
  const current = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8"));
  const previous = previousChangelog(process.env.GITHUB_EVENT_BEFORE || "");
  const fresh = entriesToAnnounce(current, previous.entries, previous.known);
  if (!fresh.length) {
    console.log("No new changelog entries.");
    return;
  }
  const secret = process.env.PUSH_NOTIFY_SECRET || "";
  const url = process.env.PUSH_NOTIFY_URL || "";
  if (!secret || !url) {
    console.log("PUSH_NOTIFY_SECRET or PUSH_NOTIFY_URL is not set, so no notification was sent.");
    return;
  }
  for (const entry of fresh) await announce(entry, url, secret);
  console.log(`Notified subscribers about ${fresh.length} changelog ${fresh.length === 1 ? "entry" : "entries"}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  });
}

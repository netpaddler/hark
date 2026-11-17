// Dates in the changelog are calendar days, YYYY-MM-DD, with no time zone.
// Labels and grouping stay on that day so a reader in the evening does not
// see the batch move to the next morning.

export function changelogDateLabel(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return String(iso || "");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function changelogPubDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).toUTCString();
}

// Entries are already newest first. Batches that share a date stay in that
// order under one heading.
export function groupChangelog(entries) {
  const groups = [];
  for (const entry of entries || []) {
    if (!entry || typeof entry.date !== "string" || !Array.isArray(entry.hymns)) continue;
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.batches.push(entry);
    else groups.push({ date: entry.date, batches: [entry] });
  }
  return groups;
}

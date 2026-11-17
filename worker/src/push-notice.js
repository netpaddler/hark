// One changelog entry becomes the sentence a notification shows.
// "From Sunday's services" with three hymns is "3 new hymns from Sunday's services".

export function entryKey(entry) {
  const hymns = Array.isArray(entry && entry.hymns) ? entry.hymns.join(",") : "";
  const note = entry && typeof entry.note === "string" ? entry.note : "";
  return `${entry && entry.date ? entry.date : ""}|${hymns}|${note}`;
}

export function pushNotice(entry) {
  const count = Array.isArray(entry && entry.hymns) ? entry.hymns.length : 0;
  const lead = count === 1 ? "1 new hymn" : `${count} new hymns`;
  const note = entry && typeof entry.note === "string" ? entry.note.trim() : "";
  if (!note) return lead;
  if (/^from\b/i.test(note)) return `${lead} ${note.charAt(0).toLowerCase()}${note.slice(1)}`;
  return `${lead}. ${note}`;
}

// A deploy with no earlier changelog to compare against must not announce the
// whole book. Only a known previous file can mark an entry as new.
export function entriesToAnnounce(current, previous, baselineKnown) {
  if (!baselineKnown) return [];
  const seen = new Set((Array.isArray(previous) ? previous : []).map(entryKey));
  return (Array.isArray(current) ? current : []).filter(
    (entry) => entry && Array.isArray(entry.hymns) && entry.hymns.length > 0 && !seen.has(entryKey(entry)),
  );
}

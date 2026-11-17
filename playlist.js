// Which songs can play straight through, and when each one must stop.
// A caption end is a spoken handoff after the song (a prayer, a reading,
// or the next announcement). Anything else stops on a short estimate so a
// worship video cannot run on into the rest of the service by itself.

import { faithRecordings, hymnsInTheme } from "./hymn-model.js";

export const STANZA_SECONDS = 40;
export const ESTIMATE_LEAD = 12;

export function captionEnd(item) {
  if (!item || item.endSource !== "captions") return null;
  const start = typeof item.start === "number" ? item.start : 0;
  const end = item.end;
  if (typeof end !== "number" || !Number.isFinite(end) || end <= start + 5) return null;
  return Math.floor(end);
}

export function estimatedEnd(start, stanzas) {
  const from = typeof start === "number" && Number.isFinite(start) ? start : 0;
  const count = Math.max(1, Number(stanzas) || 1);
  return Math.floor(from) + ESTIMATE_LEAD + count * STANZA_SECONDS;
}

// trustworthy is true only for a caption end. Play all uses those.
// Every other song still gets a stop time, from the stanza estimate.
export function playbackStop(item, hymn) {
  const start = item && typeof item.start === "number" ? item.start : 0;
  const caption = captionEnd(item);
  if (caption != null) return { start, at: caption, trustworthy: true };
  const stanzas = hymn && Array.isArray(hymn.stanzas) ? hymn.stanzas.length : 0;
  return { start, at: estimatedEnd(start, stanzas), trustworthy: false };
}

function trackFrom(hymn, item, stop) {
  return {
    number: hymn.number,
    title: hymn.title,
    videoId: item.id,
    start: stop.start,
    end: stop.at,
    trustworthy: stop.trustworthy,
    label: item.label || "",
  };
}

// Newest Faith Presbyterian recording that has a caption end.
export function themeTracks({ hymns, themes, recordings, themeId }) {
  const byNumber = new Map((hymns || []).map((hymn) => [hymn.number, hymn]));
  const tracks = [];
  for (const number of hymnsInTheme(themes, themeId)) {
    const hymn = byNumber.get(number);
    if (!hymn) continue;
    const chosen = faithRecordings(recordings, number).find(
      (item) =>
        item.kind === "youtube" &&
        item.embeddable !== false &&
        item.id &&
        captionEnd(item) != null,
    );
    if (!chosen) continue;
    tracks.push(trackFrom(hymn, chosen, playbackStop(chosen, hymn)));
  }
  return tracks;
}

export function shuffleTracks(tracks, random = Math.random) {
  const copy = tracks.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

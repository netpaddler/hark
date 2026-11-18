// Which songs can play straight through, and when each one must stop.
// A caption end is a spoken handoff after the song (a prayer, a reading,
// or the next announcement). An audio end is the same handoff, found by
// listening to a video that has no captions. Anything else stops on a short estimate so a
// worship video cannot run on into the rest of the service by itself.

import { faithRecordings, hymnsInTheme } from "./hymn-model.js";

export const STANZA_SECONDS = 40;
export const ESTIMATE_LEAD = 12;

export function captionEnd(item) {
  if (!item || (item.endSource !== "captions" && item.endSource !== "audio")) return null;
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

function timedTrack(hymn, recordings) {
  if (!hymn) return null;
  const chosen = faithRecordings(recordings, hymn.number).find(
    (item) =>
      item.kind === "youtube" &&
      item.embeddable !== false &&
      item.id &&
      captionEnd(item) != null,
  );
  if (!chosen) return null;
  return trackFrom(hymn, chosen, playbackStop(chosen, hymn));
}

// Songs in the order given, keeping the first copy of a number.
// A theme is not required. Songs without a caption end are left out.
export function tracksForHymns({ hymns, recordings }) {
  const tracks = [];
  const seen = new Set();
  for (const hymn of hymns || []) {
    if (!hymn || seen.has(hymn.number)) continue;
    seen.add(hymn.number);
    const track = timedTrack(hymn, recordings);
    if (track) tracks.push(track);
  }
  return tracks;
}

// Newest Faith Presbyterian recording that has a caption end.
export function themeTracks({ hymns, themes, recordings, themeId }) {
  const byNumber = new Map((hymns || []).map((hymn) => [hymn.number, hymn]));
  const listed = hymnsInTheme(themes, themeId)
    .map((number) => byNumber.get(number))
    .filter(Boolean);
  return tracksForHymns({ hymns: listed, recordings });
}

// Every song in the book that has a caption end, in hymn number order.
export function songsWithEndings({ hymns, recordings }) {
  const sorted = [...(hymns || [])].sort((a, b) => a.number - b.number);
  return tracksForHymns({ hymns: sorted, recordings });
}

// Timed songs from `number` through the end of the book. No wrap.
export function songsFromNumber(tracks, number) {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter((track) => track.number >= number);
}

// The song that should start after the one at `index`.
// Auto play all follows hymn number through `catalog` and wraps.
// It does not stay inside a theme, a search, or the list that started playback.
// With auto off, a list continues in list order. A single song steps to the
// next higher number and stops after the last one.
export function nextPlay({ catalog, queue, index, auto, singleAdvance = false }) {
  const list = Array.isArray(queue) ? queue : [];
  const at = Number.isInteger(index) ? index : 0;
  const current = list[at];
  if (!current) return null;
  if (auto) return nextEndingSong(catalog, current.number, { wrap: true });
  if (at + 1 < list.length) return list[at + 1];
  if (singleAdvance) return nextEndingSong(catalog, current.number, { wrap: false });
  return null;
}

// The next timed song after `number`. With wrap, the last song returns the first.
export function nextEndingSong(tracks, number, { wrap = false } = {}) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const found = tracks.find((track) => track.number > number);
  if (found) return found;
  if (!wrap) return null;
  return tracks[0];
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

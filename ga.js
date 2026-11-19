import { GA4_MEASUREMENT_ID } from "./config/analytics.js";
import { trackingOff } from "./listen.js";

// Google Analytics 4. Nothing in this file may throw into playback or the page.
//
// Cookies: GA4 runs with its normal first party cookies (_ga and _ga_<id>),
// so returning visitors, distinct users, sessions, engagement time, and user
// lifetime all work. Do not add the client_storage "none" setting or other cookieless
// options here. Google signals is on. Ad personalization is left at Google's
// default.
//
// Privacy: Global Privacy Control turns all of this off (see trackingOff in
// listen.js). Do Not Track is not checked any more.

let started = false;

function ready() {
  return Boolean(GA4_MEASUREMENT_ID) && !trackingOff() && typeof window.gtag === "function";
}

export function startAnalytics(userProps) {
  try {
    if (started || !GA4_MEASUREMENT_ID || trackingOff()) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    const props = cleanParams(userProps);
    if (Object.keys(props).length) window.gtag("set", "user_properties", props);
    // Hark is a single page with hash routes, so the automatic page_view would
    // only ever count the first page. gaPage sends one for every route.
    //
    // Note: while the Google tag setting "Ignore duplicate instances of on-page
    // configuration" is on in GA Admin, Google ignores the options below and
    // still sends its own page_view at load, with no hash route in it. That
    // can only be changed in Admin, not from here.
    window.gtag("config", GA4_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: true,
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    document.head.append(script);
  } catch {
    /* analytics must never affect playback */
  }
}

// GA4 keeps at most 100 characters of a parameter value. Empty values are
// dropped so an event never carries a blank hymn title.
export function cleanParams(params) {
  const out = {};
  try {
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === "") continue;
      if (typeof value === "number") {
        if (Number.isFinite(value)) out[key] = value;
      } else if (typeof value === "boolean") out[key] = value ? 1 : 0;
      else out[key] = String(value).slice(0, 100);
    }
  } catch {
    /* ignore */
  }
  return out;
}

// The parameters every hymn event shares.
export function hymnParams(hymn, extra) {
  const params = {};
  if (hymn && Number.isInteger(hymn.number)) params.hymn_number = hymn.number;
  if (hymn && typeof hymn.title === "string") params.hymn_title = hymn.title;
  return cleanParams({ ...params, ...(extra || {}) });
}

export function gaPage(path, title) {
  try {
    if (!ready()) return;
    const route = path || "#/";
    window.gtag("event", "page_view", {
      page_title: String(title || document.title || "Hark").slice(0, 100),
      page_location: `${location.origin}${location.pathname}${location.search}${route}`,
      page_path: route,
      transport_type: "beacon",
    });
  } catch {
    /* ignore */
  }
}

export function gaEvent(name, params) {
  try {
    if (!ready()) return;
    window.gtag("event", name, cleanParams(params));
  } catch {
    /* ignore */
  }
}

export function gaUserProps(props) {
  try {
    if (!ready()) return;
    const clean = cleanParams(props);
    if (Object.keys(clean).length) window.gtag("set", "user_properties", clean);
  } catch {
    /* ignore */
  }
}

// A coarse bucket, so the count of liked songs never singles a visitor out.
export function likedBucket(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "0";
  if (n < 5) return "1-4";
  if (n < 10) return "5-9";
  if (n < 25) return "10-24";
  return "25+";
}

export const PROGRESS_MARKS = [25, 50, 75, 100];

// Which listen_progress marks a song has newly passed. `seen` is a Set kept
// for one play of one song. Each mark is returned once and then remembered.
export function progressMarks(track, now, seen) {
  const fresh = [];
  try {
    const start = Number(track && track.start) || 0;
    const end = Number(track && track.end);
    const at = Number(now);
    if (!Number.isFinite(end) || !Number.isFinite(at) || end <= start) return fresh;
    const percent = ((at - start) / (end - start)) * 100;
    for (const mark of PROGRESS_MARKS) {
      if (percent >= mark && !seen.has(mark)) {
        seen.add(mark);
        fresh.push(mark);
      }
    }
  } catch {
    /* ignore */
  }
  return fresh;
}

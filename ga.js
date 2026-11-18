import { GA4_MEASUREMENT_ID } from "./config/analytics.js";
import { trackingOff } from "./listen.js";

let started = false;

function ready() {
  return Boolean(GA4_MEASUREMENT_ID) && !trackingOff() && typeof window.gtag === "function";
}

export function startAnalytics() {
  try {
    if (started || !GA4_MEASUREMENT_ID || trackingOff()) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    document.head.append(script);
  } catch {
    /* analytics must never affect playback */
  }
}

export function gaPage(path) {
  try {
    if (!ready()) return;
    window.gtag("event", "page_view", {
      page_path: path || "/",
      transport_type: "beacon",
    });
  } catch {
    /* ignore */
  }
}

export function gaEvent(name, params) {
  try {
    if (!ready()) return;
    window.gtag("event", name, params || {});
  } catch {
    /* ignore */
  }
}

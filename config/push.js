// The public VAPID key and the Worker address. The private key stays on the
// Worker. Leave endpoint empty and the Notify me button says it is not open.

export const pushConfig = {
  endpoint: "https://hark-requests.netpaddler.workers.dev",
  vapidPublicKey: "BOv3KiVHSNSaOXPjN87gZnLI7H3PZ8hd6VT2re5-iO0qyMrNsG4ogBp0S_-at0_GRa1ql1nNRvh2BGWNxEbZVMw",
};

export function pushOpen(config = pushConfig) {
  return typeof config.endpoint === "string"
    && /^https:\/\//.test(config.endpoint)
    && typeof config.vapidPublicKey === "string"
    && config.vapidPublicKey.length >= 80;
}

export function urlBase64ToBytes(value) {
  const pad = (4 - (value.length % 4)) % 4;
  const binary = atob(String(value).replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

// iPhone and iPad only deliver web push from an installed home screen app,
// and only on iOS 16.4 or newer. A plain Safari tab is told that, instead of
// failing with a browser error.
export function pushBlockReason(env) {
  const ua = String((env && env.userAgent) || "");
  const ios = /iPad|iPhone|iPod/.test(ua) || (env && env.platform === "MacIntel" && Number(env.maxTouchPoints) > 1);
  if (ios && !(env && env.standalone)) {
    return "On iPhone, add Hark to your Home Screen first. Notifications work from the installed app.";
  }
  if (!env || !env.serviceWorker || !env.pushManager || !env.notification) {
    if (ios) return "This iPhone needs iOS 16.4 or newer for notifications.";
    return "This browser cannot show notifications.";
  }
  return "";
}

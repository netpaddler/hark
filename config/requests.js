// The form posts to a Cloudflare Worker. The endpoint is public.
// The GitHub token stays in the Worker, not in this file.
// Leave endpoint empty until the Worker is deployed. Hark then shows
// "Comments/Requests open soon".
// turnstileSiteKey is the public Turnstile site key. The matching secret
// stays in the Worker.

export const requestConfig = {
  endpoint: "",
  turnstileSiteKey: "",
  repo: "netpaddler/hark",
  label: "hymn-request",
};

export function requestsOpen(config = requestConfig) {
  return typeof config.endpoint === "string" && /^https:\/\//.test(config.endpoint);
}

# Web push: Notify me

A reader who presses Notify me gets a browser notification when hymns are added. The What's New page and the RSS feed list the same additions from `data/changelog.json`. The notice is a short sentence, such as "3 new hymns from Sunday's services", and it opens What's New. It does not include lyrics.

The routes live on the existing requests Worker, `https://hark-requests.netpaddler.workers.dev`. A separate free KV namespace, `hark-push`, stores subscriptions and nothing else. The key is a hash of the push endpoint. The value is the subscription JSON and the time it was saved.

## Routes

- `POST /subscribe` stores a push subscription from the site. A body that is not a subscription is ignored. The same hourly limit as comments applies, on its own counter.
- `POST /unsubscribe` deletes that subscription.
- `POST /notify` checks `Authorization: Bearer` against the `PUSH_NOTIFY_SECRET` secret, then sends one Web Push message to each subscription. A push service answer of 404 or 410 deletes that subscription. The call can carry a `cursor` so a long list stays inside the free tier's subrequest limit.

GitHub Actions calls `/notify` with no browser Origin. The site calls the other two routes, and only the allowed origins are accepted.

## Keys

The public VAPID key is in `config/push.js` and in `worker/wrangler.toml` as `VAPID_PUBLIC_KEY`. The private key is the Worker secret `VAPID_PRIVATE_JWK`. It is not in the repository. `VAPID_SUBJECT` is `mailto:netpaddler@gmail.com`.

`PUSH_NOTIFY_SECRET` is a Worker secret. The same value has to be the GitHub Actions secret `PUSH_NOTIFY_SECRET`, or the deploy step logs that it could not send and the site still publishes.

## When a notice goes out

The deploy workflow, after the site is published, runs `scripts/notify-push.mjs`. It compares `data/changelog.json` with the file in the previous commit (`github.event.before`). Each entry that is new is posted to `/notify`. A note that starts with "From" is woven into the sentence: three hymns and "From Sunday's services" become "3 new hymns from Sunday's services".

If the previous commit cannot be read, nothing is sent. That keeps the hymns already in the book from being announced as new.

## The page

The button is on What's New and in the header. Pressing it again unsubscribes. On iPhone, web push works only from the Home Screen app, and only on iOS 16.4 or newer. In Safari itself the button explains that, and it does not ask for permission it cannot use.

The service worker shows the notification and opens `#/whats-new` when it is tapped. Shipping that handler takes a new cache name in `sw.js`.

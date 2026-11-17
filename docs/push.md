# Web push: Notify me

This is a design note for a later change. Nothing in this file is built or deployed. There is no Cloudflare Worker, no KV namespace, and no VAPID key pair yet.

A reader who presses Notify me should get a browser notification when hymns are added. The What's New page and the RSS feed already list those additions from `data/changelog.json`. Push is a second way to hear about the same list.

## What has to exist before it can ship

1. A VAPID key pair. The public key is safe to put in the page. The private key is a secret on the Worker only. Generate the pair locally. Do not commit the private key.

2. A Cloudflare Worker on the free plan. The page origin is `https://hymns.theweightofglory.com/`. The Worker can sit on a path of that host, or on a `workers.dev` host the page is allowed to call.

3. A KV namespace on the free plan. It stores push subscriptions and nothing else. The key is a hash of the subscription endpoint. The value is the subscription JSON (`endpoint`, `keys.p256dh`, `keys.auth`) and the time it was saved. No accounts, and no hymn text.

4. Three Worker routes:
   - `POST /subscribe` stores the subscription the page sends. Ignore a body that is not a push subscription.
   - `POST /unsubscribe` deletes that subscription.
   - `POST /notify` checks a secret header, then sends one Web Push message (RFC 8291) to each stored subscription, signed with the VAPID private key. Delete a subscription when the push service answers 404 or 410.

5. The page. A Notify me button asks for notification permission, then calls `pushManager.subscribe` with `userVisibleOnly: true` and the VAPID public key. It posts the resulting subscription to the Worker. The same control can turn the subscription off.

6. The service worker. A `push` handler shows a notification. The payload is the date, the hymn numbers and titles, and the optional note. It does not include lyrics. A `notificationclick` handler opens `#/whats-new` or the hymn. Shipping that handler means a new cache name in `sw.js`, or installed copies keep the old worker.

7. A sender. When the Monday bulletin routine appends a `data/changelog.json` entry, something must call `POST /notify`. A GitHub Action on `main` can do that, with the shared secret stored in the repository secrets. The payload stays small: date, numbers, titles, and the note. Web Push payloads are only a few kilobytes.

## Limits

The free Worker and KV quotas are enough for a short list of readers: one fan-out reads the subscriptions and writes the deletions. Do not put the hymnal in KV. Do not create the Worker, the namespace, or the keys until this design is accepted.

# Hark

Hark is a phone-first hymnal for reading the words of hymns from the Trinity Hymnal (1990), the hymnal of the PCA and OPC. It is meant for pulling up a number quickly, including from an Android home screen. Worship recordings from Faith Presbyterian Church, Tacoma, play on the hymn page, and a choir recording can be added later.

This copy has hymns from the Trinity Hymnal. The wording in `data/hymns.json` is the text to sing. Do not edit it.

## Run it locally

The page loads the hymn file with `fetch`, so open it from a small web server rather than as a file on disk.

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080>.

Tests, with no install step:

```bash
node --test
```

## Welcome page

A first visit to the bare address opens on a welcome page, `#/welcome`. It says what Hark is and has four buttons: Browse the hymns, Browse by season, Install Hark, and Request a hymn. A search box opens a hymn by its number, or the list with the search filled in. Below that are a hymn for today, a few figures, what Hark offers, and the seasons.

Nothing on the page is written down by hand that the data can answer. The copy and the rules are in `welcome.js`.

- **The figures** are counted from `data/hymns.json`, `data/recordings.json`, and `data/music.json` each time the page is drawn: hymns with their words, hymns listed by number and title, recordings, and tunes with music. A hymn whose words are withheld is left out of every figure.
- **The featured hymns** come from the season the day falls in: Advent from the fourth Sunday before Christmas to Christmas Eve, Christmas from December 25 to January 5, and Epiphany from January 6 to the end of January. The rest of the year they come from All Year, and in the four weeks before Advent a line says when Advent begins. The first hymn moves on by one each day. Only a hymn whose words are shown whole is featured. A withheld hymn, a hymn with no words yet, and a hymn with stanzas left out for copyright are never featured.
- **The public domain line** ("Every hymn text in Hark is in the public domain.") is shown only while every hymn that has words in `data/hymns.json` is marked `public_domain: true`.

Returning readers do not see the welcome page unless they ask for it:

- The installed app always opens on the hymn list.
- So does anyone who has opened a hymn before. Opening a hymn sets `hark-returning` in the browser's storage.
- So does anyone who used Hark before the welcome page existed. They have a service worker running and no mark in storage, and that is how they are told apart from a newcomer, who is marked `hark-newcomer` on the first visit.
- `#/` is still the hymn list for everyone, and every other address works as before. Only the bare address, with nothing after it, can open on the welcome page.
- An About Hark link beside the hymn count opens the welcome page at any time.

The choice is made by a small script in `index.html` before the first paint, so the list and the welcome page never flash one after the other.

## Browse

The hymn list has a search box, section chips, and tabs for Number, Title, Author, Themes, and Sins.

- **Number** keeps hymnal order. Each row shows the number, title, and tune.
- **Title** is a table of contents, alphabetical by title. A leading A, An, or The is skipped when sorting, so a later hymn called "The First Noel" files under F. The A to Z bar on the right jumps to a letter. Drag it the way you would a contacts index.
- **Author** groups hymns by author and by translator, filed under the surname. John Mason Neale is listed as "Neale, John Mason (tr.)". A paraphrase credit is marked "(para.)". A hymn can appear under more than one name.
- **Themes** groups the same hymns by season and by topic. A season or topic opens as a list of numbers and titles. On a hymn, the same themes are small links, such as `#/theme/incarnation`.
- **Comments/Requests** is `#/requests`. Leave a comment or request any hymn. We read every one. The old address `#/comments` opens the same page.
- **Sins** is a reading page, `#/sins`. It opens with the Westminster Shorter Catechism on what sin is, then the Ten Commandments, the works of the flesh, the seven things the Lord hates, and sins of the heart and tongue. It ends with repentance and the gospel. Hymn links appear only where the words already speak of sin, pardon, repentance, or grace.

Search checks the number, title, any line of the text (including the refrain), and also the author, translator, and tune. The section chips and the search apply to the Number, Title, Author, and Themes tabs. The Sins tab stays out of that search. Deep links look like `#/hymn/203`, `#/title`, `#/author`, and `#/sins`.

## Sections

Filter chips are built from the `section` field. Nothing in the interface is hard-coded to Advent and Christmas. To add Lent, Easter, Thanksgiving, or a topic, add hymns to `data/hymns.json` with that `section` name. Preferred chip order is Advent, Christmas, Lent, Holy Week, Easter, Ascension, Pentecost, Thanksgiving. Any other name is added after those, in the order it first appears.

## A hymn page

The hymn page uses large type. It shows the number, the title, and a short credit line (author, translator, tune, composer). Stanzas use `stanza_numbers` when that list is present, so no. 196 is numbered 1 and 4 rather than 1 and 2. A refrain is printed after every stanza when `refrain_after_each_stanza` is true, and once after the stanzas otherwise.

Previous and next follow hymnal number. Back returns to the list you came from.

Where a public domain score is on file, the hymn page has a Music section with the tune, a credit for the harmony, and Play and Stop. The piano sound may need a connection the first time you press Play. If the setting is still under copyright, or no pre-1931 score was found, the page says the music is not shown. Sources are listed in `docs/data.md`.

A hymn whose whole text is under copyright is not in Hark. If a public-domain hymn has a `copyright_note` or a gap in `stanza_numbers`, Hark shows the public domain stanzas and puts a short copyright note in place of each copyrighted stanza.

## Hear it at Faith Presbyterian

Worship recordings from [Faith Presbyterian Church, Tacoma](https://www.youtube.com/@faithpresbyterianchurch-ta4701) are in `data/recordings.json`, separate from the hymn texts so you can update them on their own. The file is an object keyed by Trinity Hymnal number. Each number maps to a list of recordings.

On the hymn page, Hark shows "Hear it at Faith Presbyterian" after the words. Recordings are listed newest first, with the date and the label. The newest one has a player that starts at `start_seconds`. Every recording also has a YouTube link that opens at the same moment. Older recordings stay tucked under "earlier recordings" until you open them. `confidence` and `notes` stay in the file for editors and are not shown.

Nos. 204 and 205 share one text with two tunes, and so do nos. 222 and 223. On those hymns Hark adds a note that the tune sung may differ.

To add or change a recording, edit only `data/recordings.json`:

```json
"203": [
  {
    "label": "Sunday Morning Worship, Dec 25, 2022, congregation",
    "video_title": "Sunday Morning Worship - December 25, 2022",
    "video_date": "2022-12-25",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID&t=120s",
    "start_seconds": 120,
    "confidence": "medium",
    "notes": "Optional note for editors. Not shown in the app."
  }
]
```

`video_date` is `YYYY-MM-DD` and decides the order. `url` should be a YouTube watch link with `&t=120s` (or the matching `start_seconds`) so the link opens at the hymn. Leave a number out, or give it an empty list, when there is no recording yet.

Prefer a recording of the full congregation singing. If a hymn in this file was sung during the Lord's Supper, when the singing is sparse, replace it only when another Faith livestream has the same hymn sung by the full congregation and the start time is verified from the captions. If no such recording is available, keep the existing entry. Do not drop a recording only because it was sung at communion. Do not guess a start time. Use the label "congregation" only when the congregation is asked to sing.

## Sermons on the Sins tab

`data/sermons.json` holds Faith Presbyterian sermons for the Sins tab. It is separate from the hymn texts. `page` is the list for the closing repentance and gospel section, in the order given. The other lists are `ten-commandments`, `works-of-the-flesh`, `heart-and-tongue`, and `proverbs-6`. An empty list stays hidden. `service` and `note` stay in the file for editors and are not shown.

Each sermon has `title`, `date` (`YYYY-MM-DD`), `preacher`, `text` (the Scripture the sermon takes up), `url`, and `start_seconds`. A YouTube sermon has a player that starts at `start_seconds`, and a link that opens at the same moment.

```json
{
  "page": [
    {
      "title": "Sermon title",
      "date": "2026-01-04",
      "preacher": "Name",
      "text": "1 John 1:9",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "start_seconds": 120
    }
  ],
  "ten-commandments": [],
  "works-of-the-flesh": [],
  "proverbs-6": [],
  "heart-and-tongue": []
}
```

## Choir recordings

Add an optional `recordings` array on a hymn in `data/hymns.json` when you have a choir file of your own. Each item needs a `label` and a `url`. The url can be an audio file or a YouTube link. When a hymn has neither a Faith recording nor a choir file, the page shows a quiet line that a choir recording is coming soon.

```json
"recordings": [
  {
    "label": "Choir rehearsal",
    "url": "recordings/203.mp3"
  },
  {
    "label": "Congregation",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }
]
```

Put audio files in the repo (for example `recordings/203.mp3`) and use a site-relative url, or point at a file you already host. `mp3`, `m4a`, `ogg`, `wav`, and similar addresses use an audio player. `mp4` and `webm` use a video player. YouTube and youtu.be links are embedded. Other web addresses are treated as audio.

The words are cached for offline reading. A recording still needs a network connection unless the browser has already stored that file.

## Comments/Requests

The page is `#/requests`. `#/comments` opens the same page. Visitors do not log in. The form posts to a Cloudflare Worker. The Worker opens a public GitHub issue and adds a reply. The page loads past submissions with a GET to that same Worker. The Worker reads the issues with its own token and returns plain text. No token is stored in the site. Redeploy the Worker after this change, or the list still fails.

GitHub Discussions are not used.

The live endpoint is `https://hark-requests.netpaddler.workers.dev`. Until `endpoint` in `config/requests.js` is an `https://` address, the page says "Comments/Requests open soon".

### What you set up

1. A Cloudflare account on the free plan.
2. A Turnstile widget (also free) for this site. Put the site key in `turnstileSiteKey` in `config/requests.js`. Keep the secret key for the Worker.
3. A fine grained GitHub token:
   - Resource owner: `netpaddler`
   - Repository access: only `netpaddler/hark`
   - Repository permission: Issues, Read and write
   - No other repository permissions. Discussions permission is not required.
4. Deploy the Worker in `worker/`:

```bash
cd worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

5. Paste the Worker URL into `endpoint` in `config/requests.js`, then deploy the site again.

The token user's name is the name on the public issue and the reply. A separate free GitHub account, added as a collaborator with that same Issues permission, keeps the reply off your personal account. That account is optional.

The Worker allows 5 posts an hour from one address, drops a filled honeypot, and checks Turnstile when `TURNSTILE_SECRET` is set. The site loads Turnstile only when `turnstileSiteKey` is set.

## Install Hark

The live app is <https://hymns.theweightofglory.com/>. <https://netpaddler.github.io/hark/> redirects there. The install page, with steps and a QR code, is <https://hymns.theweightofglory.com/#/install>.

On the home screen, a small Install Hark link in the top right opens the install page.

- The link is plain text in a muted color. It hides once Hark is installed or already open as an app.
- The install page has the steps. On Android, use the three dot menu, then Add to Home screen or Install app. On iPhone, use Safari, tap Share, then Add to Home Screen.

The install link and the QR code in `icons/hark-qr.svg` both open the live site, the address in `INSTALL_URL` in `install.js`. The code is a file in the repo, not a link to an outside image service. There is no Play Store or App Store listing.

To change the address, edit `INSTALL_URL`, then draw the code again on your own machine:

```sh
pip install segno==1.6.6
python3 scripts/make_qr.py
```

The tests read the address back out of the picture and fail if it is not `INSTALL_URL`.

The manifest uses a relative `start_url`, `scope`, and `id` of `./`, and icon paths of `./icons/...`, including maskable icons. The service worker is registered for the folder that contains the app, so the same files install at the domain root or in a subfolder.

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`. It also runs `node --test` first. The repository can stay private while you use Hark locally. GitHub Pages from Actions on the free plan needs a public repository. When you are ready:

1. Make this repository public.
2. In Settings, open Pages. Under Build and deployment, set Source to GitHub Actions.
3. Push to `main`, or run "Deploy GitHub Pages" by hand from the Actions tab. The workflow runs on every push to `main`, and you can start it yourself.
4. The site is at <https://hymns.theweightofglory.com/>. The old project address redirects there.

If Pages is not turned on yet, the workflow tries to enable it and set the source to GitHub Actions. You can also turn that on yourself under Settings, Pages.

Paths are relative, so the same files work at the domain root and on a project site.

## Data and type

Source notes, copyright, and caveats are in [docs/data.md](docs/data.md). The hymns are in [data/hymns.json](data/hymns.json). Seasons and topics are in [data/themes.json](data/themes.json).

The recording file is a full scan of the Faith Presbyterian channel: 126 entries. How they were found, and which hymns have none, is in [docs/recordings.md](docs/recordings.md).

The reading face is [Newsreader](https://github.com/productiontype/Newsreader) by Production Type, under the SIL Open Font License. See [fonts/OFL.txt](fonts/OFL.txt).

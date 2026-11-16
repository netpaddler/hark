# Hark

Hark is a phone-first hymnal for reading the words of hymns from the Trinity Hymnal (1990), the hymnal of the PCA and OPC. It is meant for pulling up a number quickly, including from an Android home screen. Worship recordings from Faith Presbyterian Church, Tacoma, play on the hymn page, and a choir recording can be added later.

This copy has hymns from the Trinity Hymnal: nos. 193 to 233, plus nos. 108, 162, 401, and 559. The wording in `data/hymns.json` is the text to sing. Do not edit it.

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

## Browse

The home screen has a search box, section chips, and tabs for Number, Title, Author, Themes, and Sins.

- **Number** keeps hymnal order. Each row shows the number, title, and tune.
- **Title** is a table of contents, alphabetical by title. A leading A, An, or The is skipped when sorting, so a later hymn called "The First Noel" files under F. The A to Z bar on the right jumps to a letter. Drag it the way you would a contacts index.
- **Author** groups hymns by author and by translator, filed under the surname. John Mason Neale is listed as "Neale, John Mason (tr.)". A paraphrase credit is marked "(para.)". A hymn can appear under more than one name.
- **Themes** groups the same hymns by season and by topic. A season or topic opens as a list of numbers and titles. On a hymn, the same themes are small links, such as `#/theme/incarnation`.
- **Sins** is a reading page, `#/sins`. It opens with the Westminster Shorter Catechism on what sin is, then the Ten Commandments, the works of the flesh, the seven things the Lord hates, and sins of the heart and tongue. It ends with repentance and the gospel. Hymn links appear only where the words already speak of sin, pardon, repentance, or grace.

Search checks the number, title, any line of the text (including the refrain), and also the author, translator, and tune. The section chips and the search apply to the Number, Title, Author, and Themes tabs. The Sins tab stays out of that search. Deep links look like `#/hymn/203`, `#/title`, `#/author`, and `#/sins`.

## Sections

Filter chips are built from the `section` field. Nothing in the interface is hard-coded to Advent and Christmas. To add Lent, Easter, Thanksgiving, or a topic, add hymns to `data/hymns.json` with that `section` name. Preferred chip order is Advent, Christmas, Lent, Holy Week, Easter, Ascension, Pentecost, Thanksgiving. Any other name is added after those, in the order it first appears.

## A hymn page

The hymn page uses large type. It shows the number, the title, and a short credit line (author, translator, tune, composer). Stanzas use `stanza_numbers` when that list is present, so no. 196 is numbered 1 and 4 rather than 1 and 2. A refrain is printed after every stanza when `refrain_after_each_stanza` is true, and once after the stanzas otherwise.

Previous and next follow hymnal number. Back returns to the list you came from.

Where a public domain score is on file, the hymn page has a Music section with the tune, a credit for the harmony, and Play and Stop. The piano sound may need a connection the first time you press Play. If the setting is still under copyright, or no pre-1931 score was found, the page says the music is not shown. Sources are listed in `docs/data.md`.

If `public_domain` is false, Hark shows the title, number, author, and `copyright_note`, and tells you to see the printed Trinity Hymnal. It does not show the words. If a public-domain hymn has a `copyright_note` or a gap in `stanza_numbers`, Hark says which stanzas are omitted and where they would have been.

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

## Install Hark

The live app is <https://netpaddler.github.io/hark/>. The install page, with steps and a QR code, is <https://netpaddler.github.io/hark/#/install>.

On the home screen, tap **Install Hark**.

- In Android Chrome, and in Chrome or Edge on a computer, that button opens the browser's own install prompt when the browser offers one.
- If the prompt is not available, the button opens short steps. On Android, use the three dot menu, then Add to Home screen or Install app. On iPhone, use Safari, tap Share, then Add to Home Screen.
- The button hides once Hark is installed or already open as an app.

The QR code in `icons/hark-qr.svg` points at the live site. It is a file in the repo, not a link to an outside image service. There is no Play Store or App Store listing.

The manifest uses `start_url` and `scope` of `/hark/`, with 192 and 512 icons, including maskable icons. The service worker is registered for that same folder, so on GitHub Pages its scope is `/hark/`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`. It also runs `node --test` first. The repository can stay private while you use Hark locally. GitHub Pages from Actions on the free plan needs a public repository. When you are ready:

1. Make this repository public.
2. In Settings, open Pages. Under Build and deployment, set Source to GitHub Actions.
3. Push to `main`, or run "Deploy GitHub Pages" by hand from the Actions tab. The workflow runs on every push to `main`, and you can start it yourself.
4. The site will be at <https://netpaddler.github.io/hark/>.

If Pages is not turned on yet, the workflow tries to enable it and set the source to GitHub Actions. You can also turn that on yourself under Settings, Pages.

Paths are relative, so the same files work at the domain root and on a project site.

## Data and type

Source notes, copyright, and caveats are in [docs/data.md](docs/data.md). The hymns are in [data/hymns.json](data/hymns.json). Seasons and topics are in [data/themes.json](data/themes.json).

The recording file is a full scan of the Faith Presbyterian channel: 126 entries. How they were found, and which hymns have none, is in [docs/recordings.md](docs/recordings.md).

The reading face is [Newsreader](https://github.com/productiontype/Newsreader) by Production Type, under the SIL Open Font License. See [fonts/OFL.txt](fonts/OFL.txt).

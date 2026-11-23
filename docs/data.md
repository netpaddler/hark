# Hark: hymn data notes

File: `data/hymns.json`. It holds the Trinity Hymnal (1990) hymns that Faith Presbyterian has sung, nos. 193-233 plus the hymns taken from the bulletins, and the song 801. See the bulletin sections below for how each kind is added.

## Songs that are not in the Trinity Hymnal

The Trinity Hymnal (1990) ends at no. 742. A song Faith Presbyterian has sung that is not in the hymnal is filed under a number from 801 up. That number is only the song's place in the list and its address (`#/hymn/801`), and it keys `recordings.json`, `themes.json`, `music.json`, and `changelog.json` like any other. Hark never shows it or searches by it: `inHymnal`, `numberLabel`, and `numberedTitle` in `hymn-model.js` decide what is shown. Keep these numbers at 999 or below, because the listening counter does not take a higher one.

The page for such a song never names the Trinity Hymnal. `sourceWording` in `hymn-model.js` gives the lines that name a source: a hymnal hymn gets the Trinity Hymnal wording, and any other song gets its Faith Presbyterian bulletin, or no line when it has none. Do not write the hymnal's name into the page code.

- 801 Hail, Gladdening Light. The Phos Hilaron in John Keble's 1834 translation, to John Stainer's SEBASTE, from the September 13, 2026 evening bulletin. Asked for by a reader in issue #52.

## Likes

A heart on the hymn page stores that hymn number in the browser under `hark-likes`. The Liked tab reads the same list. Nothing is sent to a server, and the hymn files are not changed. The list still works when the device is offline, because the page and this store are both on the device.

## What's New

`data/changelog.json` is the list of hymns added to Hark. The What's New page and the RSS feed (`feed.xml`) both read it. Each entry has a `date` (`YYYY-MM-DD`), a `hymns` array of hymn numbers, and an optional `note` such as "From the Nov 15 AM and PM services". Entries are newest first. Batches that share a date appear together under that date.

Every hymn addition must append a `changelog.json` entry. The Monday bulletin routine will do that when it adds hymns. Put the new entry first, and list only numbers that are in `data/hymns.json`. If a hymn is later removed from the book, take its number out of the changelog so the page and the feed do not link to a hymn that is gone. Do not use an en dash or an em dash in a note.

After the changelog changes, run `npm run build:feed` (`scripts/build-feed.mjs`) and commit `feed.xml` with it. The deploy workflow runs that same script before it publishes the site, so the feed updates whenever `changelog.json` changes. Bump the cache name in `sw.js` in the same change, or an installed copy keeps the previous list.

The first three entries are a seed from the git history of `data/hymns.json`. They are all dated 2026-11-16, the day those commits landed, and they list only numbers that are still in the book. After the site deploys, a new changelog entry notifies readers who pressed Notify me. See [push.md](push.md).

## Fields
These are the requested fields plus one extra, `stanza_numbers`. It gives the hymnal's stanza number for each entry in `stanzas`. It matters for no. 196, where only stanzas 1 and 4 are given. Stanza numbers and "[Refrain]" markers have been removed from the lines. `refrain` is printed once. `refrain_after_each_stanza` is true wherever the source marks the refrain as repeated.

A hymn sung to more than one tune has `alt_tunes`, a list of `{ tune, composer, meter, book, number, source_url }`, and `tune_book`, the book that sets it to its main `tune`. The page then names every tune with its book, as in "WINCHESTER NEW (1990 Trinity Hymnal) · also sung to MARYTON (1961 Trinity Hymnal)". Nos. 99 and 578 have these now. No. 578 is set to ALL SAINTS NEW in the 1990 Trinity Hymnal, but the Nov 22, 2026 evening bulletin prints MINSTREL BOY.

## Sources
1. **hymnary.org Trinity Hymnal (1990) instance pages**, `https://hymnary.org/hymn/TH1990/N`. These supplied the full text, stanza order, author, translator, tune, composer and copyright lines.
   - Live hymnary.org blocked automated fetches (bot challenge and 403s).
   - Pages 193-233 were therefore read from Internet Archive Wayback Machine snapshots of those URLs.
   - Page 162 was fetched live.
   - `source_url` gives the canonical hymnary URL.
2. **hymnary.org TH1990 hymn index**, pages 101-200 and 201-300. Used to find numbers, titles and tunes.
3. **No. 196, Wesley stanzas.** Charles Wesley's public domain 1744 text, from the hymnary.org representative text at https://hymnary.org/text/come_thou_long_expected_jesus_born_to.

The text is Trinity Hymnal wording as hymnary.org shows it. It is not a scan of the printed book. Check against the printed hymnal before printing for congregational use.

## Copyright
Pete decided on 2026-11-21 that a hymn in a Faith Presbyterian bulletin is good enough, even when its words are under copyright. So a hymn whose whole text is under copyright is added, but Hark never stores or types its words.

- The entry has the number, title, author, translator, tune, composer, and the copyright line as the bulletin prints it (`copyright_note`). `public_domain` is `false`, `stanzas` and `stanza_numbers` are empty, and `refrain` is null. `source_url` is the bulletin PDF.
- The hymn page shows the bulletin page picture (`scripts/build-bulletin-images.py`) where the words would be, under the note "The words are under copyright, so they are shown as printed in the Faith Presbyterian bulletin." The code is the `isWithheld` branch in `app.js`.
- A test requires each such hymn to have a bulletin picture and no stored stanza text.
- A text counts as under copyright when its credit line shows a copyright notice, or a text alteration dated 1961 or 1990 (for example "alt. 1990"), or a revision from a modern book. A date printed with the tune only is not a text alteration (nos. 28 and 281). A bare "Mod." with no date is not a copyright. When the call was close it went to the copyright side: no. 421 ("Rev. in Lutheran Book of Worship, 1978") and no. 703 ("Rev. by Edmund P. Clowney, 1986").
- Hymns added this way on 2026-11-21: 5, 6, 9, 26, 30, 32, 36, 46, 53, 75, 103, 125, 149, 164, 168, 182, 239, 242, 251, 257, 279, 283, 304, 305, 363, 367, 371, 407, 415, 416, 421, 433, 453, 455, 469, 493, 597, 660, 689, 692, 703, 719. This includes every number that was omitted before (5, 36, 46, 53, 103, 125, 168, 239, 257, 305, 363, 415, 469, 660, 689, 703, 719).
- The welcome figures leave these hymns out, as before. Search finds them by number, title, author, and tune, but never by a lyric line, since none is stored.

## Bulletin archive (backfill of 2026-11-21)
The church site keeps only the current bulletin (https://www.faithtacoma.org/information/bulletin). Older ones were found by probing the file host by Sunday date, since the site's media list is behind a bot check. A PDF is at `https://faithtacoma.sfo2.cdn.digitaloceanspaces.com/YYYY/MM/<M>.<D>.<YY>Bulletin-am-6x9-1.pdf` (and `-pm-`). Older names also exist: `<M>.<D>.<YY>Bulletin-am.pdf` and `-pm.pdf` (2021), `<M>.<D>.<YY>bulletin-am.pdf` (early 2021), and `<M>.<D>.<YY>bulletin.pdf` with no service (2015 to 2018). The month folder is sometimes the month before the date.

- Earliest bulletin found: May 10, 2015. Latest: November 15, 2026.
- 193 PDFs were found for 144 Sundays: 2015 (27), 2016 (42), 2017 (3), 2018 (3), 2021 (50), 2023 (14), 2024 (19), 2026 (35). Nothing was found for the rest of 2018, for 2019, 2020, 2022, 2025, or for 2026 before July 19, under any name tried. Those bulletins may not be online.
- The PDFs are kept outside the repo, in `~/hark-work/bulletin-cache`.
- The 2015 to 2018 bulletins print only the hymn title and number, with no music or credit line. The 32 hymns that were listed from them with only a title and number were removed again, since an entry with no words and no bulletin picture has nothing to show. That leaves 112 hymns from the backfill: 68 public domain and 42 under copyright (shown as the bulletin page). Nos. 339 and 686 have music in the bulletin but no credit line, so they are listed with a title and number and "Words not added yet", without an author or tune.
- Songs with no number in the bulletin (for example "In Christ Alone", "By Faith", "Behold the Lamb") are not in the Trinity Hymnal. They were not added.
- Each new hymn links the latest bulletin that has it. Dates when an existing hymn was sung again are not recorded; the data has no field for that.
- A hymn whose music runs over a page break has its picture made from both pages stacked, with `--page 53=4,5`.

## Bulletin texts
Some hymns take their words from a Faith Presbyterian Tacoma bulletin. `source_url` is that bulletin PDF. The printed wording is the text, including punctuation and hyphenation such as treasure-store. Syllable hyphens in a music underlay are joined into words. A credit line that shows a copyright, or a 1961 or 1990 alteration of the text, is not given words. An alteration dated on the tune only is not a text alteration.

### Bulletin pictures
The hymn page shows a picture of the bulletin page, and the picture links to the PDF. It is a picture because a phone browser, Android Chrome above all, shows a PDF inside a page as an empty box.

`scripts/build-bulletin-images.py` makes the pictures. For each hymn whose `source_url` is a Faith bulletin (the rule in `faithBulletin`), it downloads the PDF, picks the page with the hymn, renders it 900 pixels wide, and saves `bulletins/<number>.webp`. It also writes `data/bulletins.json`, which tells the page which hymns have a picture, the PDF and page it came from, and its size. A hymn with no entry there shows the text link only.

The page is picked by its text: the caption `No. <number>`, lines of the hymn, and the title each count. When nothing matches, page 1 is used; the script says so, and that picture should be looked at.

Run it after adding a bulletin hymn. It needs PyMuPDF and Pillow, which are not part of the repo:

```
python3 -m venv ~/.venvs/hark-bulletins
~/.venvs/hark-bulletins/bin/pip install pymupdf pillow
~/.venvs/hark-bulletins/bin/python scripts/build-bulletin-images.py
```

Hymns that already have a picture from the same PDF are skipped. Give hymn numbers to do only those, and `--force` to make them again. Commit the new files in `bulletins/` and `data/bulletins.json`. A test fails when a bulletin hymn has no picture.

**Partial:**
- 196 Come, Thou Long-Expected Jesus. Stanzas 1 and 4 are Charles Wesley, 1744, and are shown. Stanzas 2 and 3 are by Mark E. Hunt, text copyright 1978 InterVarsity Christian Fellowship, and each is replaced by a copyright note. The entry is marked `public_domain: true`.

Licensed words can come from:
- the printed Trinity Hymnal (Great Commission Publications);
- the rights holders;
- CCLI SongSelect or OneLicense, for reprint or projection.

## Uncertainties
- **Section boundaries.**
  - "Advent" (193-198) follows the hymnary topic "Jesus Christ: His Advent".
  - "Christmas" (199-233) is inferred from hymn order, between the Advent hymns and no. 234 ("His Life"). It was not checked against the printed table of contents.
  - Nos. 190-192 (children's hymns) and 234 were excluded.
- **No. 162** is not in the Advent or Christmas section of the hymnal. It was included because it is in the Advent 2026 series. It is labeled 'Christmas' by choice.
- **Editorial alterations.** The hymnal credits alterations dated 1951 (no. 194) and 1961 (nos. 206, 207, 226), plus modernizations (206, 227). These are minor changes to public domain texts, and hymnary.org shows them with no copyright notice. They are treated as public domain, but the copyright status of the alterations was not independently confirmed.
  - No. 194, stanza 4 ("Dayspring, from on high, and cheer us by thy drawing nigh") is the most visible altered line.
- **No. 196 punctuation.** The capitalization and punctuation of the Wesley stanzas come from a representative text, not from TH 196 itself.
- **Translation dates** for no. 221 (1875, 1894, 1914) and Neale's 1854 date for no. 162 come from standard sources. The instance pages do not give them.
- **Tune credits.** No. 198 (TRURO) has no tune composer in the source, so `composer` is null. Tune arrangements under copyright do not affect the text, but matter if music is reproduced:
  - 227 (Stainer & Bell)
  - possibly 214 (1937)
- **Dashes.** All en and em dashes were removed:
  - no. 199, stanza 3: replaced with a comma;
  - nos. 222 and 223, stanza 2: replaced with commas.
  Curly quotes were normalized to straight quotes.
- **Spellings** follow the source, for example "heav'n".

## Themes
File: `data/themes.json`. These tags do not change the hymn lines in `data/hymns.json`.

`seasons` and `topics` name each group. Each has an `id` and a `title`. `hymns` is keyed by hymnal number. Each hymn lists `seasons` and `topics` by those ids.

Seasons follow the hymnal `section`, then the text:
- Advent: `section` is Advent.
- Christmas: `section` is Christmas. That includes no. 162, which this file labels Christmas.
- Epiphany: the words tell of the star, the wise men, or the child shown to the nations. Those hymns also keep Christmas, because that is their section here.
- All Year: nos. 108, 401, and 559. Their sections are God's Work: His Decrees, The Church: Evening, and The Christian Life: Obedience. All Year is listed after Epiphany.

No. 108 is tagged Providence and Trusting God in Trials. No. 559 is tagged Providence and Contentment. No. 401 is tagged Evening and Joy and Praise.

A hymn may have more than one topic. A topic is used only when the words clearly teach it.

Lent, Holy Week, Easter, Ascension, Pentecost, and Thanksgiving are not listed while no hymn uses them. Add the id under `seasons`, and on the hymns that belong there, and the Themes tab will show the new group.

Each group has a link, `#/theme/` plus the id. For example, `#/theme/incarnation`.

## Music

Scores are ABC files in `data/music/`, listed in `data/music.json`. Each one is a public domain setting from a book published before 1931, taken from the Open Hymnal Project, not from the Trinity Hymnal. The page says the harmony may differ from the Trinity Hymnal setting. The first Play may download a piano sound.

### Scores

- 162 DIVINUM MYSTERIUM (SATB). Plainsong melody. Four-part setting from The Church Hymnal, Revised and Enlarged (Episcopal), 1892, hymn 52, via the Open Hymnal Project.
- 193 PICARDY (SATB). French melody. Four-part setting from The English Hymnal, 1906, hymn 318, via the Open Hymnal Project.
- 194 VENI EMMANUEL (SATB). 15th century processional melody. Four-part setting from the Common Service Book (ULCA), 1917, hymn 1, via the Open Hymnal Project.
- 196 HYFRYDOL (SATB). Rowland Hugh Pritchard, 1830. Four-part setting from The English Hymnal, 1906, hymn 563, via the Open Hymnal Project. That book does not credit Pritchard for the harmony.
- 197 THIRSTING (melody). Melody from Trente Quatre Pseaumes de David, Geneva, 1551, via the Open Hymnal Project. The four-part setting in a 1931 book was not used.
- 199 SEE AMID THE WINTER'S SNOW (SATB). John Goss, 1870, also called Humility. Four-part setting from The Children's Hymnal, with Tunes, 1875, hymn 233, via the Open Hymnal Project.
- 204 MUELLER (SATB). James R. Murray, 1887. Four-part setting from Hymnal for American Youth, 1919, hymn 84, via the Open Hymnal Project.
- 208 ADESTE FIDELES (SATB). John Francis Wade, 1743. Four-part setting from A Hymnal (Episcopal), 1916, hymn 72, via the Open Hymnal Project.
- 211 GOD REST YOU MERRY (SATB). English melody. Four-part setting from Carols Old and Carols New, 1918, carol 722, via the Open Hymnal Project.
- 217 WARUM SOLLT' ICH MICH DENN GRAMEN (SATB). Johann Georg Ebeling, 1666. Four-part setting from The Chorale Book for England, 1863, hymn 31, via the Open Hymnal Project.
- 218 REGENT SQUARE (SATB). Henry Smart, 1867. Four-part setting from Psalms and Hymns for Divine Worship, 1867, hymn 58, via the Open Hymnal Project.
- 221 ES IST EIN' ROS' ENTSPRUNGEN (SATB). German melody, Koln, 1599. Michael Praetorius, 1609. Four-part setting from The English Hymnal, 1906, hymn 19, via the Open Hymnal Project.
- 226 DIX (SATB). Conrad Kocher, 1838, abridged by William Henry Monk, 1861. Four-part setting from The English Hymnal, 1906, hymn 39, via the Open Hymnal Project.
- 401 TALLIS' CANON (SATB). Thomas Tallis, about 1567. Four-part setting from A Hymnal (Episcopal), 1916, hymn 25, via the Open Hymnal Project.
- 99 WINCHESTER NEW (SATB). Musikalisches Handbuch, Hamburg, 1690. Four-part setting by Charles Lewis Hutchins from The Church Hymnal, 1896, hymn 197, via the Open Hymnal Project. This is the tune before the 1990 alteration. Hymn 99 is also sung to MARYTON (H. Percy Smith, 1874). The Open Hymnal Project has no MARYTON score, and no other engraved score with a recorded pre-1931 source was found, so the score entry lists MARYTON under `also` with that reason and the page shows it under the music credit.

### Left out

- 108 WAS GOTT TUT. WAS GOTT TUT is attributed to Severus Gastorius (1681) and is old, but no engraved score with a recorded pre-1931 source was found.
- 195 ANTIOCH. ANTIOCH is Lowell Mason's 1836 arrangement, but the only ABC score found lists Lutheran Worship (1982) as its music source. Notes from a copyrighted hymnal were not used.
- 198 TRURO. TRURO is an 18th century tune, but no engraved score with a recorded pre-1931 source was found. Another setting of this text uses a different tune and was not substituted.
- 201 ST. LOUIS. No engraved score with a recorded pre-1931 public domain source was found.
- 203 MENDELSSOHN. MENDELSSOHN is the Cummings arrangement of Mendelssohn, but the only ABC score found lists Lutheran Worship (1982) as its music source. Notes from a copyrighted hymnal were not used.
- 205 CRADLE SONG. CRADLE SONG by William J. Kirkpatrick (1895) is old, but no engraved score with a recorded pre-1931 source was found. A file that cites a 1993 hymnal was not used.
- 206 MORNING STAR. MORNING STAR by James P. Harding is old, but no engraved score with a recorded pre-1931 source was found.
- 207 IN DULCI JUBILO. IN DULCI JUBILO is a 14th century melody, but no engraved score with a recorded pre-1931 source was found.
- 209 YORKSHIRE. YORKSHIRE by John Wainwright is old, but no engraved score with a recorded pre-1931 source was found.
- 210 STILLE NACHT. No engraved score with a recorded pre-1931 public domain source was found.
- 213 GREENSLEEVES. No engraved score with a recorded pre-1931 public domain source was found.
- 214 GLORIA. GLORIA is a French carol melody, but the Trinity Hymnal uses an arrangement from 1937. A score that also cites Lutheran Worship (1982) was not used.
- 216 W ZLOBIE LEZY. W ZLOBIE LEZY is a traditional Polish melody. The arrangement named in the hymn data is from a carol book whose date was not confirmed, and no pre-1931 score was found.
- 219 CANONBURY. CANONBURY is from Robert Schumann and is old, but no engraved score with a recorded pre-1931 source was found.
- 222 WINCHESTER OLD. WINCHESTER OLD is from Thomas Este, 1592, but the hymn data notes a 1990 alteration of the tune. No pre-1931 score of the unaltered tune was retrieved, so the 1990 form was not copied.
- 223 CHRISTMAS. CHRISTMAS is Handel arranged by Lowell Mason and is old, but no engraved score with a recorded pre-1931 source was found.
- 225 IRBY. IRBY by Henry J. Gauntlett (1849) is old, but the score that was found cites a 1994 hymnal as its source and was not used.
- 227 SUSSEX CAROL. SUSSEX CAROL is a traditional melody. The Trinity Hymnal uses an arrangement associated with Stainer and Bell. That arrangement was not copied, and no separate pre-1931 folk setting was found.
- 559 MORWELLHAM. MORWELLHAM is by Charles Steggall, who died in 1905, but no engraved score with a recorded pre-1931 source was retrieved.

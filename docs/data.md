# Hark: hymn data notes

File: `data/hymns.json`. It holds 42 entries: Trinity Hymnal (1990) nos. 193-233, plus no. 162.

## Fields
These are the requested fields plus one extra, `stanza_numbers`. It gives the hymnal's stanza number for each entry in `stanzas`. It matters for no. 196, where only stanzas 1 and 4 are given. Stanza numbers and "[Refrain]" markers have been removed from the lines. `refrain` is printed once. `refrain_after_each_stanza` is true wherever the source marks the refrain as repeated.

## Sources
1. **hymnary.org Trinity Hymnal (1990) instance pages**, `https://hymnary.org/hymn/TH1990/N`. These supplied the full text, stanza order, author, translator, tune, composer and copyright lines.
   - Live hymnary.org blocked automated fetches (bot challenge and 403s).
   - Pages 193-233 were therefore read from Internet Archive Wayback Machine snapshots of those URLs.
   - Page 162 was fetched live.
   - `source_url` gives the canonical hymnary URL.
2. **hymnary.org TH1990 hymn index**, pages 101-200 and 201-300. Used to find numbers, titles and tunes.
3. **No. 196, Wesley stanzas.** Charles Wesley's public domain 1744 text, from the hymnary.org representative text at https://hymnary.org/text/come_thou_long_expected_jesus_born_to.

The text is Trinity Hymnal wording as hymnary.org shows it. It is not a scan of the printed book. Check against the printed hymnal before printing for congregational use.

## Withheld for copyright
`public_domain` is false and `stanzas` is empty for these:
- 212 Within a Crib My Savior Lay. Text © 1968 Hope Publishing Co.
- 230 Thou Who Wast Rich beyond All Splendor. Text by Frank Houghton (d. 1972), © CMF International (OMF).
- 231 Lovely Child, Holy Child. Text and tune © 1968 Augsburg Publishing House (Augsburg Fortress).
- 232 O Jesus Sweet, O Jesus Mild. Translation by Mark E. Hunt, © 1978 InterVarsity Christian Fellowship.

**Partial:**
- 196 Come, Thou Long-Expected Jesus. Stanzas 2-3 are by Mark E. Hunt, © 1978 InterVarsity Christian Fellowship, and are omitted. Only Wesley's stanzas, which are hymnal stanzas 1 and 4, are included. The entry is marked `public_domain: true` and carries a `copyright_note`. The app should show a notice that stanzas are omitted.

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
- **Editorial alterations.** The hymnal credits alterations dated 1951 (no. 194) and 1961 (nos. 206, 207, 220, 226), plus modernizations (206, 227). These are minor changes to public domain texts, and hymnary.org shows them with no copyright notice. They are treated as public domain, but the copyright status of the alterations was not independently confirmed.
  - No. 194, stanza 4 ("Dayspring, from on high, and cheer us by thy drawing nigh") is the most visible altered line.
- **No. 196 punctuation.** The capitalization and punctuation of the Wesley stanzas come from a representative text, not from TH 196 itself.
- **Translation dates** for no. 221 (1875, 1894, 1914) and Neale's 1854 date for no. 162 come from standard sources. The instance pages do not give them.
- **Tune credits.** No. 198 (TRURO) has no tune composer in the source, so `composer` is null. Tune arrangements under copyright do not affect the text, but matter if music is reproduced:
  - 202 (Oxford University Press)
  - 227 (Stainer & Bell)
  - possibly 214 (1937) and 229 (1930)
- **Dashes.** All en and em dashes were removed:
  - no. 199, stanza 3: replaced with a comma;
  - nos. 222 and 223, stanza 2: replaced with commas.
  Curly quotes were normalized to straight quotes.
- **Spellings** follow the source, for example "Counsellor" and "Counselor" in no. 233, and "heav'n".

# Faith Presbyterian Church Tacoma: hymn recordings on YouTube

Output: `data/recordings.json`, keyed by Trinity Hymnal number. Each entry has a link that opens the video at the hymn.

## Channel
- https://www.youtube.com/@faithpresbyterianchurch-ta4701 (channel id UCdS_fZEWwUFzYxgVtVuYxKw, "Faith Presbyterian Church - Tacoma WA").
- Pete confirmed it. The church website (https://www.faithtacoma.org) links to the same channel id.
- Older video descriptions say "Worship service of Faith Presbyterian Church (PCA) in Tacoma, Washington."

## What was scanned
- All 622 videos on the channel were checked. They are all on the Live tab, from late 2020 to Nov 15, 2026; there is no Videos tab. 544 have English auto captions, and all 544 were analyzed. YouTube did not block anything: there were no 429 errors or bot checks.
- **Priority set: 102 videos.** These are every service dated Nov 22 through Jan 12, plus every special service and every untitled "Live Stream" from 2020 and 2021. Metadata and captions were downloaded for each, and 85 have captions.
- **Remaining services: 520 videos**, scanned for captions only, in two passes. The first pass covered 234 and the second covered the other 286. 459 of the 520 have captions. For these off-season videos only spoken announcements were matched, not sung lyrics alone. Lyric-only matches in ordinary services were mostly sermon or Scripture quotations.
- **Second pass results:** the 286 newly scanned videos added 5 recordings, 4 for hymn 198 and 1 for hymn 162. No hymn got its first recording. These rejected candidates were removed:
  - sermon mentions of "Go, Tell It on the Mountain" and "Of the Father's Love Begotten";
  - a Mar 17, 2024 announcement of "How Deep the Father's Love", a different song;
  - two Scripture hits on "what is this".
- **Priority videos with no captions**, so nothing could be found in them:
  - Christmas Eve 2023 9:00 pm
  - Christmas Eve 2021 4:00 pm and 11:00 pm
  - Dec 1, 2024 (morning and evening)
  - Dec 15, 2024 (morning)
  - Jan 12, 2025 (morning)
  - Nov 26, 2023 (morning)
  - Dec 3, 2023 (morning and evening)
  - Dec 18, 2022 (evening)
  - Dec 12, 2021 (morning)
  - Dec 19, 2021 (evening)
  - two special services and one 2020 or 2021 stream
- **Christmas Eve coverage:** no Christmas Eve videos were found on the channel for 2022, 2024 or 2025. The ones present are 2020 (untitled streams), 2021 and 2023.

## Method
- **No chapters or orders of worship.** No video has chapters, and the descriptions give only the preacher and sermon. So none of the confidence ratings can be "high" by the brief's rule (a chapter or description confirming the hymn).
- **Spoken announcements (most entries).** The auto captions were searched for the leader announcing the hymn by title, for example "as we stand and sing hymn number Hark! the herald angels sing". The captions drop the spoken hymn number. The link starts about 3 seconds before the announced title, so the organ introduction and the first stanza follow. Many entries also have sung lines from the hymn in the captions just after.
- **Sung lyrics (a few entries).** Where no announcement was caught, the entry was found by matching several distinct sung lines. Matches that turned out to be Scripture readings or sermon quotations were removed. Examples: Luke 2 matching "the Savior, who is Christ the Lord", and Mark 6:3 matching "the son of Mary".
- **Spot checks.** Every candidate was checked by reading the caption text after its start time.
  - **Rejected:** sermon mentions, a joke announcement, "laid him in a manger" (Luke 2), "what is this" (Luke 24 and Genesis 37), and other false hits.
  - **Hand-placed starts:** where the captions showed the hymn starts later than the first match, the start was moved by hand. These are noted per entry.
- **Confidence.** Every entry is "medium". That means a caption match: an announcement, sung lyrics, or both.
- **Choir or congregation.** The label says "congregation" when the announcement asks people to stand or sing together. Otherwise it says "unspecified". No choir-only performances were identified with confidence.
- **Full congregation preferred.** Prefer the full congregation singing. A hymn sung during the Lord's Supper, when the singing is sparse, should be replaced only when another service has that hymn sung by the full congregation and the start time is verified from the captions. If no such recording is available, keep the existing entry. Do not drop a recording only because it was sung at communion. Do not guess a start time.
- **Hymns sharing words.** Captions cannot tell which tune was used, so those recordings are listed under both numbers:
  - 204 and 205
  - 222 and 223
- **Not verified by ear.** Nothing was checked by listening. Check a link by ear before sharing it widely.

## Results by hymn
| No. | Title | Recordings |
|---|---|---|
| 162 | Of the Father's Love Begotten | 8 |
| 193 | Let All Mortal Flesh Keep Silence | 5 |
| 194 | O Come, O Come, Emmanuel | 4 |
| 195 | Joy to the World! The Lord is Come | 6 |
| 196 | Come, Thou Long-Expected Jesus | 6 |
| 197 | Comfort, Comfort Ye My People | 1 |
| 198 | Lift Up Your Heads, Ye Mighty Gates! | 8 |
| 199 | See, amid the Winter's Snow | 1 |
| 201 | O Little Town of Bethlehem | 3 |
| 203 | Hark! The Herald Angels Sing | 9 |
| 204 | Away in a Manger | 1 |
| 205 | Away in a Manger | 1 |
| 206 | Brightest and Best of the Sons of the Morning | 4 |
| 207 | Good Christian Men, Rejoice | 6 |
| 208 | O Come, All Ye Faithful | 7 |
| 209 | Christians, Awake, Salute the Happy Morn | 2 |
| 210 | Silent Night! Holy Night! | 1 |
| 211 | God Rest You Merry, Gentlemen | 0 |
| 213 | What Child Is This | 6 |
| 214 | Angels We Have Heard on High | 7 |
| 216 | Infant Holy, Infant Lowly | 5 |
| 217 | All My Heart This Night Rejoices | 4 |
| 218 | Angels, from the Realms of Glory | 6 |
| 219 | All Praise to Thee, Eternal Lord | 3 |
| 221 | Lo, How a Rose E'er Blooming | 1 |
| 222 | While Shepherds Watched Their Flocks | 4 |
| 223 | While Shepherds Watched Their Flocks | 4 |
| 225 | Once in Royal David's City | 4 |
| 226 | As with Gladness Men of Old | 9 |
| 227 | On Christmas Night All Christians Sing | 4 |

- Silent Night (210) has one entry, from Christmas Eve 2020 at 11:00 pm.
  - It is also announced for the close of Christmas Eve 2020 at 4:00 pm (video gyux6d9UtBM, roughly 3680s to 4160s) and 2023 at 4:00 pm (video GcyYETKpWVI, roughly 3365s to 3750s).
  - In both, the sung captions are too garbled to place a start, so they are not in `data/recordings.json`.

## Hail, Gladdening Light (Sep 13, 2026 evening)

Filed under 801, since it is not in the Trinity Hymnal. Video qsIlxwIVZqY. The video carries auto-dubbed audio tracks in other languages, so the original English track was the one downloaded and analyzed, in a temporary folder that was deleted after. The start, 1073, is the spoken announcement: "Let's continue our worship now with the hymn printed in your order of service. Hail, gladdening light." The organ begins at 1080 and the singing at 1107. The end, 1216, is where the final Amen dies, just before the minister says "Let's pray together."

## Nov 15, 2026 evening: hymns 644 and 99 timed from the audio

Video yoZkY7OoPXU has no auto captions. The audio was downloaded to a temporary folder, transcribed locally, measured for sound level, and deleted after.

- 644, May the Mind of Christ My Savior: start 346 (spoken announcement), end 492.
- 99, My Song Forever Shall Record: start 1949 (spoken announcement, no hymn number spoken), end 2249. The minister says the tune differs from the bulletin. Faith's music director confirmed it was played from the 1961 (blue) Trinity Hymnal, which sets these words to MARYTON at no. 101 (https://hymnary.org/hymn/TH1961/101). The 1990 hymnal sets them to WINCHESTER NEW. The tune was later checked against the audio; see the next section. The singing pauses at 2208 for a spoken aside and resumes at 2212 for the last stanza.

## Tune named on each recording of hymn 99

A recording may carry a `tune` field. The page shows it after the label, as in "Sunday Evening Worship, Nov 15, 2026, congregation, tune MARYTON". Leave it out, or set it to null, when the tune is not known, and the label shows alone. A `tune` must be the hymn's `tune` or one of its `alt_tunes` in `data/hymns.json`.

Hymn 99 is sung to WINCHESTER NEW (1990 Trinity Hymnal) and to MARYTON (1961 Trinity Hymnal, no. 101). On Nov 18, 2026 the hymn segment of each of its six recordings was downloaded to a temporary folder, analysed, and deleted after. The melody of each of eight long meter tunes was lined up against the sound in the melody range (dynamic time warping, every key, a range of tempos). Lower cost is closer. The tunes were WINCHESTER NEW, MARYTON and six others as a check: OLD HUNDREDTH, DUKE STREET, HAMBURG, ROCKINGHAM, FEDERAL STREET and TALLIS' CANON. The WINCHESTER NEW and check melodies came from Open Hymnal Project scores, and the MARYTON melody from the Christian Classics Ethereal Hymnary MIDI file (https://www.ccel.org/cceh/0002/x000242.htm). That file was used for the comparison only and is not published.

| Recording | Closest tune | Cost | Next closest | WINCHESTER NEW | MARYTON | Key |
| --- | --- | --- | --- | --- | --- | --- |
| Nov 15, 2026 pm | MARYTON | 0.109 | TALLIS' CANON 0.148 | 0.188 | 0.109 | E flat |
| Aug 16, 2026 am | WINCHESTER NEW | 0.110 | TALLIS' CANON 0.164 | 0.110 | 0.184 | B flat |
| Mar 15, 2026 pm | WINCHESTER NEW | 0.097 | MARYTON 0.178 | 0.097 | 0.178 | B flat |
| Oct 26, 2025 pm | WINCHESTER NEW | 0.106 | DUKE STREET 0.194 | 0.106 | 0.207 | B flat |
| Jun 11, 2023 pm | WINCHESTER NEW | 0.165 | DUKE STREET 0.212 | 0.165 | 0.238 | B flat |
| Jan 30, 2022 pm | WINCHESTER NEW | 0.137 | TALLIS' CANON 0.174 | 0.137 | 0.203 | B flat |

The Nov 15 recording is the control: its tune is confirmed by the music director, and the check names MARYTON for it by a clear margin. The other five come out as WINCHESTER NEW by a margin at least as wide. A second comparison, recording against recording, agrees: the five match each other closely and none matches Nov 15 well. A first attempt that compared full four-part harmony did not tell the tunes apart and was not used. No person has checked the five by ear. Jun 11, 2023 is the weakest match of the five.

## Caveats
- Dates come from the stream start time in Pacific time. Untitled 2020 and 2021 streams were labeled morning or evening, or Christmas Eve, from that time.
- Some 2024 titles say "2023" by mistake. The stream timestamp was used instead.
- Auto captions of singing are poor. The announcement start is the most reliable anchor.

## Bulletin backfill of 2026-11-21: 113 recordings for 82 hymns
The 112 hymns added from the 2015 to 2026 bulletins had no recordings. A second pass added 113 recordings for 82 of them. 30 hymns are still without a recording; they are listed at the end of this section.

- **Service match.** Each hymn was looked up in the services whose bulletin (am or pm) lists it, using the titles "Sunday Morning Worship - <date>" and "Sunday Evening Worship - <date>". Every video ID was read from yt-dlp metadata (2026.10.26, run in a Python 3.12 environment) and checked to belong to channel UCdS_fZEWwUFzYxgVtVuYxKw. The earlier refusal ("The page needs to be reloaded") did not recur on the home connection, but YouTube returned 429 for some caption requests, so those were retried after a pause.
- **Captions (87 recordings).** Auto captions (json3) for 70 of the 87 videos involved were searched for the leader announcing the hymn (title, or title plus "hymn number"). The start is 3 seconds before the announcement. The end, where given, is the first "please be seated", "let us pray" or blessing after the hymn. It is left out when that phrase is under 100 or over 330 seconds away or another announcement comes first, so those entries have only a start. Candidates that turned out to be Scripture or a sermon mention were dropped (hymn 53 on Jun 13, 2021, and hymn 32 on Oct 18, 2026, where the announcement is missing from the captions). Hymn 257 on Aug 9, 2026 is placed by hand: the announcement does not name the hymn, but the captions that follow carry its first stanza.
- **No captions (the rest).** 17 videos have no auto captions. Their audio was downloaded to `~/hark-work/yt-cache/audio` (not in the repo) and transcribed locally with faster-whisper (tiny and base English models). The start is the spoken announcement. The end is where speech resumes after the hymn, and is left out where that was unclear. Those entries say so in their notes and use `end_source` "audio". The audio level could not tell the end of a hymn from speech over the organ, so these ends can be a few seconds late.
- **Hymn 186 on May 5, 2024 pm.** The transcript heard the number as 185, but the minister describes friendship with Jesus and the bulletin lists 186, One There Is, Above All Others. The entry says so.
- **Embedding.** `node scripts/check-embeds.mjs` found five new entries in videos that cannot be embedded; they carry `embeddable: false` like the older ones.
- **Not verified by ear.** Check a link by ear before sharing it widely.

Hymns still without a recording, and why:
- No video on the channel for the bulletin date (bulletins from 2015 to 2018 and Jan to Mar 2021): 246, 256.
- The service was found but the hymn could not be located with confidence (the announcement is missing, garbled, or the hymn the bulletin lists was not announced as printed): 101, 111, 157, 188, 242, 249, 279, 283, 307, 308, 319, 335, 359, 378, 415, 421, 424, 444, 471, 546, 567, 574, 597, 629, 646, 708.
- The bulletin date (Jan 28, 2024 pm) was not among the services matched in the earlier pass, so no video was timed: 600, 686.

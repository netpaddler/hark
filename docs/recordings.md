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

## Caveats
- Dates come from the stream start time in Pacific time. Untitled 2020 and 2021 streams were labeled morning or evening, or Christmas Eve, from that time.
- Some 2024 titles say "2023" by mistake. The stream timestamp was used instead.
- Auto captions of singing are poor. The announcement start is the most reliable anchor.

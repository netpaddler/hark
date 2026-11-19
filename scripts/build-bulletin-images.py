#!/usr/bin/env python3
"""Make a picture of the bulletin page for each hymn taken from a bulletin.

Android Chrome cannot show a PDF inside a page, so the hymn page shows a
picture of the bulletin page instead, and the picture links to the PDF.

For every hymn in data/hymns.json whose source_url is a Faith Presbyterian
bulletin (the same rule as faithBulletin() in hymn-model.js), this script:

  1. downloads the PDF (kept in a cache folder outside the repo),
  2. picks the page that has the hymn. The music is often a picture with
     only a caption as text, so a page scores for the caption "No. <number>",
     for each line of the hymn it holds, and for the title. The best page
     wins; page 1 when no page matches,
  3. renders that page about 900 pixels wide and saves bulletins/<number>.webp,
  4. writes data/bulletins.json, which the app reads to know which hymns have
     a picture and how big it is.

Needs PyMuPDF and Pillow:

    python3 -m venv ~/.venvs/hark-bulletins
    ~/.venvs/hark-bulletins/bin/pip install pymupdf pillow
    ~/.venvs/hark-bulletins/bin/python scripts/build-bulletin-images.py

Hymns that already have a picture for the same PDF are skipped. Pass --force
to make every picture again, or hymn numbers to do only those.
"""

import argparse
import hashlib
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HYMNS = ROOT / "data" / "hymns.json"
MANIFEST = ROOT / "data" / "bulletins.json"
OUT_DIR = ROOT / "bulletins"
WIDTH = 900
QUALITY = 60

# Keep in step with BULLETIN_URL in hymn-model.js.
BULLETIN_URL = re.compile(
    r"^https://faithtacoma\.sfo2\.cdn\.digitaloceanspaces\.com/\d{4}/\d{2}/"
    r"(\d{1,2})\.(\d{1,2})\.(\d{2})Bulletin-(am|pm)-6x9-1\.pdf$"
)


def is_bulletin(url):
    match = BULLETIN_URL.match(url or "")
    if not match:
        return False
    month, day = int(match.group(1)), int(match.group(2))
    return 1 <= month <= 12 and 1 <= day <= 31


def letters(text):
    """Only the letters, lower case. A music underlay splits words into
    syllables (wor - ship), and dropping everything else joins them again."""
    text = text.replace("’", "'").lower()
    return re.sub(r"[^a-z]", "", text)


def fetch_pdf(url, cache):
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / (hashlib.sha1(url.encode()).hexdigest()[:12] + "-" + url.rsplit("/", 1)[1])
    if not path.exists() or path.stat().st_size == 0:
        request = urllib.request.Request(url, headers={"User-Agent": "bulletin-images/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return path


def hymn_lines(hymn):
    lines = []
    for stanza in hymn.get("stanzas") or []:
        if isinstance(stanza, list):
            lines.extend(line for line in stanza if isinstance(line, str))
    refrain = hymn.get("refrain")
    if isinstance(refrain, list):
        lines.extend(line for line in refrain if isinstance(line, str))
    return [key for key in (letters(line) for line in lines) if len(key) >= 8]


def pick_page(doc, hymn):
    """Return (page index, score). Score 0 means nothing matched."""
    title = letters(hymn.get("title") or "")
    lines = hymn_lines(hymn)
    first = lines[0] if lines else ""
    best, best_score = 0, 0
    numbered = re.compile(r"\bNo\.\s*%d\b" % hymn["number"])
    for index in range(doc.page_count):
        raw = doc[index].get_text()
        text = letters(raw)
        score = sum(2 for line in lines if line in text)
        if first and first in text:
            score += 3
        if title and title in text:
            score += 1
        if numbered.search(raw):
            score += 4
        if score > best_score:
            best, best_score = index, score
    return best, best_score


def render(doc, index, out):
    page = doc[index]
    zoom = WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    image.save(out, "WEBP", quality=QUALITY, method=6)
    return image.width, image.height


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("numbers", nargs="*", type=int, help="only these hymn numbers")
    parser.add_argument("--force", action="store_true", help="make every picture again")
    parser.add_argument(
        "--cache",
        default=os.path.join(os.path.expanduser("~"), ".cache", "hark-bulletins"),
        help="folder for downloaded PDFs",
    )
    args = parser.parse_args()

    data = json.loads(HYMNS.read_text())
    hymns = data if isinstance(data, list) else data.get("hymns", [])
    linked = [hymn for hymn in hymns if is_bulletin(hymn.get("source_url"))]
    old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest = {}
    OUT_DIR.mkdir(exist_ok=True)
    made = 0
    failed = []

    for hymn in sorted(linked, key=lambda item: item["number"]):
        number = hymn["number"]
        key = str(number)
        url = hymn["source_url"]
        out = OUT_DIR / f"{number}.webp"
        kept = old.get(key)
        wanted = not args.numbers or number in args.numbers
        if kept and out.exists() and kept.get("pdf") == url and not (args.force and wanted):
            manifest[key] = kept
            continue
        if not wanted:
            continue
        try:
            doc = fitz.open(fetch_pdf(url, Path(args.cache)))
            index, score = pick_page(doc, hymn)
            width, height = render(doc, index, out)
        except Exception as error:  # one bad PDF must not stop the rest
            failed.append(number)
            print(f"{number}: FAILED {error}", file=sys.stderr)
            continue
        manifest[key] = {
            "src": f"bulletins/{number}.webp",
            "pdf": url,
            "page": index + 1,
            "width": width,
            "height": height,
        }
        made += 1
        how = f"score {score}" if score else "no match, fell back to page 1"
        print(f"{number}: page {index + 1} of {doc.page_count} ({how}), {out.stat().st_size // 1024} KB")

    # A picture whose hymn no longer links a bulletin is of no use.
    for path in OUT_DIR.glob("*.webp"):
        if path.stem not in manifest:
            path.unlink()
            print(f"removed {path.name}")

    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n")
    total = sum((ROOT / entry["src"]).stat().st_size for entry in manifest.values())
    print(f"{made} made, {len(manifest)} in data/bulletins.json, {total // 1024} KB in all")
    if failed:
        print(f"failed: {failed}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Draw icons/hark-qr.svg for the address in install.js.

Needs segno (pip install segno==1.6.6). Nothing is sent anywhere: the code is
worked out on this machine. Run it again whenever INSTALL_URL changes; the
tests read the code back and fail if the two disagree.
"""

import re
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons" / "hark-qr.svg"


def install_url():
    source = (ROOT / "install.js").read_text(encoding="utf-8")
    return re.search(r'export const INSTALL_URL = "([^"]+)";', source).group(1)


def main():
    url = install_url()
    # Level Q survives a quarter of the code being smudged or folded on paper.
    code = segno.make(url, error="q")
    code.save(
        str(OUT),
        kind="svg",
        scale=4,
        dark="#211c16",
        light="#fff",
        xmldecl=False,
        title=f"QR code for {url}",
        desc="Scan this code to open Hark.",
    )
    print(f"{OUT.relative_to(ROOT)}: {code.designator}, {url}")


if __name__ == "__main__":
    main()

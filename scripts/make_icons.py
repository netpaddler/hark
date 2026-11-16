#!/usr/bin/env python3
"""Draw the Hark home-screen icons. Burgundy field, open book, gold star."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
BURGUNDY = (111, 44, 44)
CREAM = (246, 240, 228)
GOLD = (230, 177, 90)
INK = (111, 44, 44)


def star_points(cx, cy, outer, inner):
    pts = []
    for i in range(8):
        radius = outer if i % 2 == 0 else inner
        # Start at the top and go clockwise.
        from math import cos, sin, pi

        angle = -pi / 2 + i * pi / 4
        pts.append((cx + radius * cos(angle), cy + radius * sin(angle)))
    return pts


def draw(size, maskable):
    scale = 4
    canvas = size * scale
    image = Image.new("RGB", (canvas, canvas), BURGUNDY)
    pen = ImageDraw.Draw(image)
    unit = canvas

    def p(x, y):
        return (x * unit, y * unit)

    # Keep the mark inside the circular safe zone used by Android masks.
    inset = 0.18 if maskable else 0.14
    pen.polygon(star_points(*p(0.5, 0.30), unit * 0.085, unit * 0.034), fill=GOLD)

    top = 0.42
    bottom = 1 - inset
    left = inset
    right = 1 - inset
    mid_l = 0.48
    mid_r = 0.52
    page_top_outer = top + 0.03
    # Left page, spine a little higher than the outer edge.
    pen.polygon(
        [
            p(left, page_top_outer),
            p(mid_l, top),
            p(mid_l, bottom - 0.02),
            p(left + 0.03, bottom),
            p(left, bottom - 0.045),
        ],
        fill=CREAM,
    )
    pen.polygon(
        [
            p(right, page_top_outer),
            p(mid_r, top),
            p(mid_r, bottom - 0.02),
            p(right - 0.03, bottom),
            p(right, bottom - 0.045),
        ],
        fill=CREAM,
    )
    # A few rules, like lines of a hymn.
    for i, y in enumerate((0.55, 0.62, 0.69)):
        reach = 0.16 if i < 2 else 0.12
        pen.line([p(left + 0.06, y), p(left + 0.06 + reach, y)], fill=INK, width=max(2, scale))
        pen.line([p(right - 0.06, y), p(right - 0.06 - reach, y)], fill=INK, width=max(2, scale))

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    any_icon = draw(512, maskable=False)
    maskable = draw(512, maskable=True)
    any_icon.save(OUT / "icon-512.png", optimize=True)
    any_icon.resize((192, 192), Image.Resampling.LANCZOS).save(OUT / "icon-192.png", optimize=True)
    maskable.save(OUT / "icon-maskable-512.png", optimize=True)
    maskable.resize((192, 192), Image.Resampling.LANCZOS).save(
        OUT / "icon-maskable-192.png", optimize=True
    )
    any_icon.resize((180, 180), Image.Resampling.LANCZOS).save(
        OUT / "apple-touch-icon.png", optimize=True
    )
    any_icon.resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "favicon-32.png", optimize=True)
    print("wrote icons")


if __name__ == "__main__":
    main()

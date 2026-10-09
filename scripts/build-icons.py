#!/usr/bin/env python3
"""Builds every Focus icon from one definition of the mark.

The mark is a ring holding a leaf, drawn on a 512 canvas. This script writes
the SVG sources to assets/, then rasterises the PNGs and favicon.ico from them.

Requires rsvg-convert (brew install librsvg) and ImageMagick (brew install imagemagick).

Usage: python3 scripts/build-icons.py
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BRAND = ASSETS / "brand"

SIZE = 512
C = SIZE / 2

# Brand colours, matching the tokens in index.html
DARK = "#1C2B1E"
SAGE = "#5A8A5E"
ICON_GRADIENT = ("#6B9B7A", "#5A8A6E", "#4A7560")

ICON_RADIUS = 0.28  # tile corner radius as a share of its size


# ── Mark ────────────────────────────────────────────────────────────────────

def leaf_mark(ring_w=34, half=78):
    """A ring holding a leaf. `half` is the leaf's tip-to-centre length."""
    arc_r = half * 96 / 78        # keeps the leaf's proportions as it scales
    ring_r = 196 + (34 - ring_w) / 2  # outer edge stays put as the stroke thickens
    ring = (f'<circle cx="{C}" cy="{C}" r="{ring_r}" fill="none" '
            f'stroke="currentColor" stroke-width="{ring_w}"/>')
    leaf = (f'<path d="M{-half} 0A{arc_r:.2f} {arc_r:.2f} 0 0 1 {half} 0'
            f'A{arc_r:.2f} {arc_r:.2f} 0 0 1 {-half} 0Z" fill="currentColor" '
            f'transform="translate({C} {C}) rotate(-35)"/>')
    return ring + leaf


REGULAR = leaf_mark()
# Heavier ring and larger leaf so the mark still reads at 32px and below.
SMALL = leaf_mark(ring_w=52, half=104)


# ── SVG renderers ───────────────────────────────────────────────────────────

def svg(body, color):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
            f'role="img" aria-label="Focus" style="color:{color}" color="{color}">{body}</svg>\n')


def mark_svg(mark, color):
    return svg(mark, color)


def icon_svg(mark, mark_scale, rounded=True):
    """The mark in white on the moss gradient tile.

    rounded=False gives a full-bleed square, for platforms that mask the
    corners themselves (iOS home screen).
    """
    stops = "".join(
        f'<stop offset="{i / (len(ICON_GRADIENT) - 1)}" stop-color="{c}"/>'
        for i, c in enumerate(ICON_GRADIENT)
    )
    rx = f' rx="{SIZE * ICON_RADIUS:.0f}"' if rounded else ""
    body = (f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient></defs>'
            f'<rect width="{SIZE}" height="{SIZE}"{rx} fill="url(#bg)"/>'
            f'<g transform="translate({C} {C}) scale({mark_scale}) translate({-C} {-C})">{mark}</g>')
    return svg(body, "#FFFFFF")


SOURCES = {
    BRAND / "focus-mark.svg": mark_svg(REGULAR, SAGE),
    BRAND / "focus-mark-dark.svg": mark_svg(REGULAR, DARK),
    BRAND / "focus-mark-white.svg": mark_svg(REGULAR, "#FFFFFF"),
    BRAND / "focus-app-icon.svg": icon_svg(REGULAR, 0.56),
    BRAND / "focus-app-icon-small.svg": icon_svg(SMALL, 0.70),
    BRAND / "focus-app-icon-square.svg": icon_svg(REGULAR, 0.56, rounded=False),
    ASSETS / "favicon.svg": icon_svg(SMALL, 0.70),
}

# (output, source svg, pixels)
PNGS = [
    (ASSETS / "focus-icon.png", BRAND / "focus-app-icon.svg", 1024),
    (ASSETS / "focus-icon-128.png", BRAND / "focus-app-icon.svg", 256),
    (ASSETS / "focus-icon-36.png", BRAND / "focus-app-icon-small.svg", 108),
    (ASSETS / "apple-touch-icon.png", BRAND / "focus-app-icon-square.svg", 180),
]

ICO = (ROOT / "favicon.ico", BRAND / "focus-app-icon-small.svg", (16, 32, 48))


# ── Rasterising ─────────────────────────────────────────────────────────────

def require(*names):
    for name in names:
        if shutil.which(name):
            return name
    sys.exit(f"error: need one of {', '.join(names)} on PATH (see the header of this script)")


def rasterise(rsvg, src, out, px):
    subprocess.run([rsvg, "-w", str(px), "-h", str(px), "-o", str(out), str(src)], check=True)


def main():
    rsvg = require("rsvg-convert")
    magick = require("magick", "convert")

    BRAND.mkdir(parents=True, exist_ok=True)
    for path, content in SOURCES.items():
        path.write_text(content)
        print(f"wrote {path.relative_to(ROOT)}")

    for out, src, px in PNGS:
        rasterise(rsvg, src, out, px)
        print(f"wrote {out.relative_to(ROOT)}  {px}x{px}")

    ico, src, sizes = ICO
    with tempfile.TemporaryDirectory() as tmp:
        layers = []
        for px in sizes:
            layer = Path(tmp) / f"{px}.png"
            rasterise(rsvg, src, layer, px)
            layers.append(str(layer))
        subprocess.run([magick, *layers, str(ico)], check=True)
    print(f"wrote {ico.relative_to(ROOT)}  {'/'.join(map(str, sizes))}")


if __name__ == "__main__":
    main()

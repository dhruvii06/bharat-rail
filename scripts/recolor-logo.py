"""Builds both theme logos from the team's light-mode logo.

Usage: python scripts/recolor-logo.py <original-light-logo> <out-light.webp> <out-dark.webp>  (needs Pillow)

on-light: the original artwork with its white background made transparent.
on-dark:  the same artwork; navy and grey parts (text, train, tagline) are flipped to light tones,
          orange and green are kept, so the brand looks the same in both themes.
"""
import colorsys
import sys
from PIL import Image

src, out_light, out_dark = sys.argv[1:4]
im = Image.open(src).convert('RGB')

# Trim the white margin around the artwork (keeping a small border), so the logo fills its box.
PAD = 12
grey = im.convert('L').point(lambda v: 255 if v < 235 else 0)
box = grey.getbbox()
if box:
    im = im.crop((max(0, box[0] - PAD), max(0, box[1] - PAD), min(im.width, box[2] + PAD), min(im.height, box[3] + PAD)))
# 1000 px wide covers the largest use (the sign-in logo on 2x screens) without shipping extra bytes.
MAX_WIDTH = 1000
if im.width > MAX_WIDTH:
    im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
w, h = im.size
light = Image.new('RGBA', (w, h))
dark = Image.new('RGBA', (w, h))

for y in range(h):
    for x in range(w):
        r, g, b = im.getpixel((x, y))
        # Colour-to-alpha against white: how much ink is mixed into the white background.
        a = max(255 - r, 255 - g, 255 - b) / 255
        if a < 0.04:
            light.putpixel((x, y), (0, 0, 0, 0))
            dark.putpixel((x, y), (0, 0, 0, 0))
            continue
        ur, ug, ub = (255 - (255 - c) / a for c in (r, g, b))
        ur, ug, ub = (max(0.0, min(255.0, c)) for c in (ur, ug, ub))
        alpha = round(a * 255)
        light.putpixel((x, y), (round(ur), round(ug), round(ub), alpha))

        hh, ll, ss = colorsys.rgb_to_hls(ur / 255, ug / 255, ub / 255)
        # Decide from the original pixel: un-mixing exaggerates the tint of faint grey edges.
        oh, ol, os_ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        navy = 0.45 <= oh <= 0.8 and ol < 0.7     # blue text and train outline (the green swoosh is not blue)
        ink = os_ < 0.2 or navy                    # plus grey tagline and shading; orange and green keep their colour
        if ink:
            ll = 1 - ll * 0.92                # dark ink becomes near-white, light grey shading becomes darker grey
            ss = ss * 0.35                    # keep a hint of the navy tint
        dr, dg, db = colorsys.hls_to_rgb(hh, ll, ss)
        dark.putpixel((x, y), (round(dr * 255), round(dg * 255), round(db * 255), alpha))

# High-quality lossy WebP keeps edges sharp at a fraction of the lossless size; alpha stays exact.
for image, out in ((light, out_light), (dark, out_dark)):
    image.save(out, 'WEBP', quality=92, alpha_quality=100, method=6)
print('saved', out_light, out_dark, f'{w}x{h}')

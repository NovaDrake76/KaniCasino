"""converts rendered banners to webp and copies them into public/images/banners.

run after render.mjs, from the repo root:  python tools/banners/publish.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "out")
DEST = os.path.join(REPO, "public", "images", "banners")

os.makedirs(DEST, exist_ok=True)

for f in sorted(os.listdir(SRC)):
    if not f.endswith(".png"):
        continue
    im = Image.open(os.path.join(SRC, f))
    out = os.path.join(DEST, f[:-4] + ".webp")
    # lockups carry alpha and need lossless edges, plates compress fine lossy
    if f.endswith("-lockup.png"):
        im.save(out, "WEBP", quality=92, method=6)
    else:
        im.convert("RGB").save(out, "WEBP", quality=82, method=6)
    print(f"{os.path.basename(out):32} {round(os.path.getsize(out) / 1024)} KB")

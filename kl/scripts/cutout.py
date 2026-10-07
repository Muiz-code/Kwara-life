"""
Cut the flat cream background off Higgsfield tiles, sprites and avatars.
Usage:  pip install pillow numpy
        python scripts/cutout.py public/assets/raw public/assets
Interiors (full-scene backgrounds) should NOT go through this script.
"""
import sys, pathlib
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

def cutout(path, out_dir, width=440):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    # Background colour = median of the border pixels
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    diff = np.abs(a - bg).sum(axis=2)
    lum = a.sum(axis=2)
    chroma = np.abs((a - a.mean(axis=2, keepdims=True)) - (bg - bg.mean())).sum(axis=2)
    # Background-like pixels, including soft cream shadows
    near = (diff < 45) | ((chroma < 22) & (lum > bg.sum() - 150))

    # Flood fill from the edges so we only remove background touching the border
    mask = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not mask[y, x]:
                mask[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True; q.append((ny, nx))

    alpha = Image.fromarray(np.where(mask, 0, 255).astype("uint8"))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.copy(); rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    rgba = rgba.resize((width, round(rgba.height * width / rgba.width)), Image.LANCZOS)
    out = pathlib.Path(out_dir) / (pathlib.Path(path).stem + ".webp")
    rgba.save(out, "WEBP", quality=82, method=6)
    print(f"{out}  {rgba.size}")

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    pathlib.Path(dst).mkdir(parents=True, exist_ok=True)
    for p in sorted(pathlib.Path(src).glob("*.png")):
        cutout(p, dst)

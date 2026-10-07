"""
Cut the flat cream background off Higgsfield tiles, sprites and avatars.
Usage:  pip install pillow numpy
        python scripts/cutout.py public/assets/raw public/assets
Interiors (full-scene backgrounds) should NOT go through this script.
Avatars (files named avatar-*) skip the enclosed-gap pass, so pale clothing survives.
"""
import sys, pathlib
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

def cutout(path, out_dir, width=440, holes=None):
    if holes is None:
        holes = not pathlib.Path(path).stem.startswith("avatar-")
    src = Image.open(path)
    if src.mode == "RGBA" and src.getextrema()[3][0] < 128:
        # Already cut out (Higgsfield background remover): keep its alpha.
        return save(src, path, out_dir, width)
    im = src.convert("RGB")
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

    # Background seen through gaps (under a billboard, inside a keke) never touches the
    # border. Remove enclosed patches that are almost exactly the background colour.
    if holes:
        strict = (diff < 12) & ~mask
        seen = np.zeros((h, w), bool)
        min_area = 0.002 * h * w
        for y0, x0 in zip(*np.nonzero(strict)):
            if seen[y0, x0]:
                continue
            seen[y0, x0] = True
            q = deque([(y0, x0)]); pts = []
            while q:
                y, x = q.popleft(); pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and strict[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if len(pts) > min_area:
                ys, xs = zip(*pts)
                mask[list(ys), list(xs)] = True

    alpha = Image.fromarray(np.where(mask, 0, 255).astype("uint8"))
    alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.copy(); rgba.putalpha(alpha)
    save(rgba, path, out_dir, width)

def save(rgba, path, out_dir, width):
    rgba = rgba.crop(rgba.getchannel("A").getbbox())
    rgba = rgba.resize((width, round(rgba.height * width / rgba.width)), Image.LANCZOS)
    out = pathlib.Path(out_dir) / (pathlib.Path(path).stem + ".webp")
    rgba.save(out, "WEBP", quality=82, method=6)
    print(f"{out}  {rgba.size}")

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    pathlib.Path(dst).mkdir(parents=True, exist_ok=True)
    for p in sorted(pathlib.Path(src).glob("*.png")):
        cutout(p, dst)

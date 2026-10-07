"""
Download every image in reference/assets.txt, then build the WebP set.
Usage:  pip install pillow numpy
        python scripts/fetch_assets.py [list-file ...]   (default: reference/assets.txt reference/tiles.txt)
Labels may include a folder, e.g. "tiles/inec" goes to public/assets/tiles/inec.webp.
- Raw PNGs land in public/assets/raw/<label>.png
- Tiles, avatars and sprites go through cutout.py into public/assets/<label>.webp
- Interiors are resized (no cutout) into public/assets/interiors/<label>.webp
"""
import pathlib, sys, urllib.request
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from cutout import cutout

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "public/assets/raw"
OUT = ROOT / "public/assets"
INTERIORS = OUT / "interiors"

def entries(files):
    for f in files:
        path = ROOT / f
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            label, kind, url = (s.strip() for s in line.split("|"))
            yield label, kind, url

def interior(path, out_dir, width=1600):
    im = Image.open(path).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = out_dir / (path.stem + ".webp")
    im.save(out, "WEBP", quality=80, method=6)
    print(f"{out}  {im.size}")

def main():
    for d in (RAW, OUT, INTERIORS):
        d.mkdir(parents=True, exist_ok=True)
    failed = []
    files = sys.argv[1:] or ["reference/assets.txt", "reference/tiles.txt"]
    for label, kind, url in entries(files):
        raw = RAW / f"{label}.png"
        raw.parent.mkdir(parents=True, exist_ok=True)
        sub = pathlib.Path(label).parent
        if not raw.exists():
            try:
                urllib.request.urlretrieve(url, raw)
            except Exception as e:
                failed.append(f"{label}: {e}")
                continue
        if kind == "interior":
            interior(raw, INTERIORS / sub)
        else:
            (OUT / sub).mkdir(parents=True, exist_ok=True)
            cutout(raw, OUT / sub)
    if failed:
        print("\nFailed downloads:\n  " + "\n  ".join(failed))
        sys.exit(1)

if __name__ == "__main__":
    main()

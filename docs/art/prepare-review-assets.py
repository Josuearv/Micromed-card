"""Exporta los derivados WebP y las hojas de miniaturas desde el manifiesto."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/art/manifest.json"
LIMIT = 150 * 1024
SIZE_BY_FAMILY = {
    "cards": (768, 576),
    "organs": (768, 768),
    "environments": (1280, 720),
}
GROUP_LABELS = {
    "players": "Cartas jugables",
    "pathogens": "Patógenos",
    "organs": "Órganos y arenas",
}


def comparison_font(size):
    for family in ("segoeui.ttf", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(family, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def export_webp(asset):
    source = ROOT / asset["sourcePath"]
    family = {"organ": "organs", "environment": "environments"}.get(asset["category"], "cards")
    key = asset["catalogId"] or "arena-clinica-tactica"
    if family == "environments" and asset["revision"] == 1:
        key += "-v1"
    relative = Path("public/assets") / family / f"{key}.webp"
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = original.convert("RGB")
        image.thumbnail(SIZE_BY_FAMILY[family], Image.Resampling.LANCZOS)
    for quality in (86, 82, 78, 74):
        encoded = io.BytesIO()
        image.save(encoded, format="WEBP", quality=quality, method=6)
        if encoded.tell() <= LIMIT:
            break
    payload = encoded.getvalue()
    target.write_bytes(payload)
    return {
        "path": relative.as_posix(),
        "widthPx": image.width,
        "heightPx": image.height,
        "bytes": len(payload),
        "quality": quality,
        "sha256": hashlib.sha256(payload).hexdigest(),
    }


def comparison_sheet(entries, label, destination):
    columns, cell_width, cell_height, padding = 4, 282, 220, 20
    rows = (len(entries) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width + 2 * padding, rows * cell_height + 88), "#101b25")
    draw = ImageDraw.Draw(sheet)
    title = comparison_font(25)
    body = comparison_font(15)
    small = comparison_font(13)
    draw.text((padding, 17), label, fill="#e9f0f4", font=title)
    draw.text((padding, 48), "96 px a la izquierda y 160 px a la derecha", fill="#b7c7d1", font=small)
    for index, asset in enumerate(entries):
        row, col = divmod(index, columns)
        x, y = padding + col * cell_width, 76 + row * cell_height
        draw.text((x, y), asset["assetId"], fill="#e9f0f4", font=body)
        with Image.open(ROOT / asset["webp"]["path"]) as original:
            for left, width in ((0, 96), (105, 160)):
                preview = original.copy()
                preview.thumbnail((width, width), Image.Resampling.LANCZOS)
                sheet.paste(preview, (x + left, y + 27 + (160 - preview.height) // 2))
    sheet.save(destination, format="WEBP", quality=90, method=6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only-listed", action="store_true", help="Exporta los registros existentes sin crear hojas.")
    args = parser.parse_args()
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for asset in data["assets"]:
        if asset.get("reviewDisposition") == "SUPERSEDED":
            continue
        asset["webp"] = export_webp(asset)
        asset["outputPath"] = asset["webp"]["path"]
    if not args.only_listed:
        sheets = {}
        assets = {asset["assetId"]: asset for asset in data["assets"]}
        for key, label in GROUP_LABELS.items():
            entries = [assets[asset_id] for asset_id in data["reviewGroups"][key]]
            path = Path(f"docs/art/qa-{key}-96-160.webp")
            comparison_sheet(entries, label, ROOT / path)
            sheets[key] = {"path": path.as_posix(), "assetIds": data["reviewGroups"][key]}
        data["catalogComparisons"] = sheets
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

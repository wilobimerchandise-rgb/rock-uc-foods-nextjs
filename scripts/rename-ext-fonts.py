# Run once from the repo root:  pip install fonttools  &&  python3 scripts/rename-ext-fonts.py
# Gives the two latin-ext Inter files their own internal name so the PDF engine embeds BOTH Inter and InterExt (otherwise the naira sign is silently dropped).
from fontTools.ttLib import TTFont
for w, suffix in (("400", "Regular"), ("700", "Bold")):
    p = f"assets/fonts/inter-latin-ext-{w}-normal.woff"
    f = TTFont(p)
    for r in f["name"].names:
        if r.nameID in (1, 16): r.string = "InterExt"
        elif r.nameID == 4: r.string = f"InterExt {suffix}"
        elif r.nameID == 6: r.string = f"InterExt-{suffix}"
        elif r.nameID == 3: r.string = f"InterExt-{suffix};ROCKUC"
    f.flavor = "woff"; f.save(p)
    print("renamed", p)

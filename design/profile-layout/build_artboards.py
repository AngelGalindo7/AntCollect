"""Emit Figma-importable SVG artboards for the collection-first profile layout.

Plain rect/text/path only - no <style>, no foreignObject, no CSS classes - so Figma's
SVG importer lands editable vector + text layers. Every `id` becomes a Figma layer name.
Run: python3 build_artboards.py
"""
from pathlib import Path

OUT = Path(__file__).parent

# Brand tokens - source of truth is frontend/src/app/index.css @theme
BLUE   = "#0064A4"
NAVY   = "#0F2D5C"
GOLD   = "#FFD200"
CREAM  = "#F4EFE6"
WHITE  = "#FAF8F4"
ESPR   = "#332D2A"
WGRAY  = "#DDD4C5"
BRICK  = "#C85A3A"
DISPLAY = "Bricolage Grotesque"
UI      = "Inter Tight"
R_CARD  = 14

RAIL_W = 56


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size=14, fill=ESPR, family=UI, weight=400, anchor="start", opacity=1.0):
    o = f' fill-opacity="{opacity}"' if opacity < 1 else ""
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}"{o}{a}>{esc(s)}</text>')


def rect(x, y, w, h, fill, rx=0, stroke=None, sw=1, opacity=1.0, dash=None, id=None):
    parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}"']
    if rx:
        parts.append(f'rx="{rx}"')
    parts.append(f'fill="{fill}"')
    if opacity < 1:
        parts.append(f'fill-opacity="{opacity}"')
    if stroke:
        parts.append(f'stroke="{stroke}" stroke-width="{sw}"')
    if dash:
        parts.append(f'stroke-dasharray="{dash}"')
    if id:
        parts.append(f'id="{esc(id)}"')
    return " ".join(parts) + "/>"


def circle(cx, cy, r, fill, stroke=None, sw=1, opacity=1.0, id=None):
    parts = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"']
    if opacity < 1:
        parts.append(f'fill-opacity="{opacity}"')
    if stroke:
        parts.append(f'stroke="{stroke}" stroke-width="{sw}"')
    if id:
        parts.append(f'id="{esc(id)}"')
    return " ".join(parts) + "/>"


def group(id, children):
    return f'<g id="{esc(id)}">\n  ' + "\n  ".join(children) + "\n</g>"


def svg(name, w, h, children, bg=CREAM):
    body = "\n".join(children)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">\n'
            f'<title>{esc(name)}</title>\n'
            f'{rect(0, 0, w, h, bg, id="artboard-bg")}\n{body}\n</svg>\n')


# ── shared pieces ────────────────────────────────────────────────────────────

def rail(h):
    """56px UCI-blue nav rail with the existing 32px gold avatar chip at the bottom."""
    kids = [rect(0, 0, RAIL_W, h, BLUE, id="rail-bg")]
    for i, y in enumerate((84, 132, 180, 228)):
        kids.append(rect(18, y, 20, 20, "#FFFFFF", rx=5, opacity=0.55, id=f"rail-icon-{i+1}"))
    kids.append(rect(18, 28, 20, 20, GOLD, rx=6, id="rail-logo"))
    kids.append(circle(28, h - 36, 16, GOLD, id="rail-avatar-chip-your-account"))
    kids.append(text(28, h - 31, "AG", 11, ESPR, UI, 700, anchor="middle"))
    return group("nav-rail", kids)


def binder_button(x, y):
    return group("binder-button", [
        rect(x, y, 104, 32, "#FFFFFF", rx=16, stroke=WGRAY, opacity=0.92),
        rect(x + 14, y + 9, 12, 14, ESPR, rx=2, opacity=0.75),
        text(x + 34, y + 21, "Binder", 13, ESPR, UI, 500),
    ])


def identity_row(x, y, name="angel.g", bio="Trading UCI anteater stickers - ZOT",
                 stickers="128", folders="6", avatar=48, id="identity-row"):
    """Viewed profile's identity. Replaces the 200px banner + 96px avatar."""
    r = avatar // 2
    kids = [
        circle(x + r, y + r, r, CREAM, stroke="#FFFFFF", sw=3, id="avatar-viewed-user"),
        text(x + r, y + r + 7, "A", 20, ESPR, DISPLAY, 600, anchor="middle", opacity=0.55),
        text(x + avatar + 16, y + 20, name, 22, ESPR, DISPLAY, 700),
        text(x + avatar + 16, y + 40, bio, 13, ESPR, UI, 400, opacity=0.68),
    ]
    sx = x + avatar + 16
    kids.append(text(sx, y + 60, stickers, 13, ESPR, UI, 700))
    kids.append(text(sx + len(stickers) * 8 + 4, y + 60, "Stickers", 13, ESPR, UI, 400, opacity=0.6))
    dx = sx + len(stickers) * 8 + 68
    kids.append(text(dx, y + 60, "·", 13, ESPR, UI, 400, opacity=0.4))
    kids.append(text(dx + 12, y + 60, folders, 13, ESPR, UI, 700))
    kids.append(text(dx + 12 + len(folders) * 8 + 4, y + 60, "Folders", 13, ESPR, UI, 400, opacity=0.6))
    return group(id, kids)


PILLS = [("Collection", "128"), ("Looking For", "12"), ("Trading Away", "5"), ("Showcase", "3")]


def pill_row(x, y, pills=PILLS, active=0, id="pill-tabs"):
    kids = []
    cx = x
    for i, (label, count) in enumerate(pills):
        w = len(label) * 7.4 + 34 + (len(count) * 7 + 14)
        w = round(w)
        on = i == active
        zero = count == "0"
        kids.append(rect(cx, y, w, 36, BLUE if on else WHITE, rx=18,
                         stroke=None if on else WGRAY,
                         id=f"pill-{label.lower().replace(' ', '-')}{'-active' if on else ''}"))
        kids.append(text(cx + 16, y + 23, label, 14, "#FFFFFF" if on else ESPR, UI,
                         600 if on else 500, opacity=0.45 if (zero and not on) else 1.0))
        bx = cx + 16 + round(len(label) * 7.4) + 8
        kids.append(rect(bx, y + 10, len(count) * 7 + 12, 16, "#FFFFFF" if on else ESPR, rx=8,
                         opacity=0.22 if on else (0.06 if zero else 0.09)))
        kids.append(text(bx + (len(count) * 7 + 12) / 2, y + 22, count, 11,
                         "#FFFFFF" if on else ESPR, UI, 600, anchor="middle",
                         opacity=0.35 if zero else (1.0 if on else 0.7)))
        cx += w + 10
    return group(id, kids)


# Placeholder sticker art. On-brand only: brand hexes at varied opacity,
# no invented hues (replaces the off-palette #2E7D5B green and #12345f navy).
ART = [(BLUE, 0.85), (BRICK, 0.85), (GOLD, 0.95), (NAVY, 0.85),
       (BLUE, 0.35), (BRICK, 0.4), (NAVY, 0.45), (GOLD, 0.5),
       (BLUE, 0.6), (NAVY, 0.25), (BRICK, 0.6), (GOLD, 0.7)]

CARD_W, CARD_H, GAP = 190, 250, 20


def sticker_card(x, y, i, label, sub, id=None):
    fill, op = ART[i % len(ART)]
    art_h = CARD_H - 66
    kids = [
        rect(x, y, CARD_W, CARD_H, WHITE, rx=R_CARD, stroke=WGRAY, id="card-surface"),
        rect(x + 10, y + 10, CARD_W - 20, art_h, fill, rx=10, opacity=op * 0.22, id="art-bg"),
        circle(x + CARD_W / 2, y + 10 + art_h / 2 - 8, 34, fill, opacity=op, id="art-shape"),
        rect(x + CARD_W / 2 - 16, y + 10 + art_h / 2 + 26, 32, 12, fill, rx=6, opacity=op * 0.7),
        text(x + 14, y + CARD_H - 30, label, 13, ESPR, UI, 600),
        text(x + 14, y + CARD_H - 13, sub, 11, ESPR, UI, 400, opacity=0.55),
    ]
    return group(id or f"sticker-card-{i+1}", kids)


def add_tile(x, y):
    return group("add-tile-owner-only", [
        rect(x, y, CARD_W, CARD_H, WGRAY, rx=R_CARD, opacity=0.16),
        rect(x, y, CARD_W, CARD_H, "none", rx=R_CARD, stroke=WGRAY, sw=2, dash="7 6"),
        circle(x + CARD_W / 2, y + CARD_H / 2 - 12, 22, BLUE, opacity=0.10),
        rect(x + CARD_W / 2 - 9, y + CARD_H / 2 - 13.5, 18, 3, BLUE, rx=1.5),
        rect(x + CARD_W / 2 - 1.5, y + CARD_H / 2 - 21, 3, 18, BLUE, rx=1.5),
        text(x + CARD_W / 2, y + CARD_H / 2 + 34, "Add a sticker", 13, BLUE, UI, 600, anchor="middle"),
    ])


NAMES = [("Peter the Anteater", "2024 - Welcome Week"), ("Zot Zot Zot", "2023 - Homecoming"),
         ("Ring Road", "2024 - Campus set"), ("Aldrich Park", "2022 - Rare"),
         ("Anteater Recreation", "2024 - Common"), ("Langson Library", "2023 - Campus set"),
         ("Middle Earth", "2024 - Housing"), ("Mesa Court", "2023 - Housing"),
         ("Science Library", "2022 - Campus set"), ("UCI Bookstore", "2024 - Common"),
         ("Anteater Express", "2023 - Transit"), ("Student Center", "2024 - Campus set")]


def grid(x, y, n, cols=6, offset=0):
    kids = []
    for i in range(n):
        cx = x + (i % cols) * (CARD_W + GAP)
        cy = y + (i // cols) * (CARD_H + GAP)
        label, sub = NAMES[(i + offset) % len(NAMES)]
        kids.append(sticker_card(cx, cy, i + offset, label, sub))
    return group("sticker-grid", kids)


# ── artboard 1: foundations ──────────────────────────────────────────────────

def artboard_foundations():
    W, H = 1000, 800
    k = [text(48, 64, "PetrCollect — Foundations", 30, ESPR, DISPLAY, 700),
         text(48, 88, "Source of truth: frontend/src/app/index.css @theme", 13, ESPR, UI, 400, opacity=0.6),
         text(48, 136, "Color", 18, ESPR, DISPLAY, 700)]
    swatches = [("UCI Blue", BLUE), ("UCI Navy", NAVY), ("UCI Gold", GOLD), ("Warm Cream", CREAM),
                ("Soft White", WHITE), ("Espresso", ESPR), ("Warm Gray", WGRAY), ("Brick", BRICK)]
    for i, (nm, hx) in enumerate(swatches):
        x = 48 + (i % 4) * 228
        y = 158 + (i // 4) * 130
        k.append(rect(x, y, 200, 72, hx, rx=R_CARD, stroke=WGRAY if hx in (CREAM, WHITE, GOLD) else None,
                      id=f"swatch-{nm.lower().replace(' ', '-')}"))
        k.append(text(x, y + 92, nm, 13, ESPR, UI, 600))
        k.append(text(x, y + 109, hx, 12, ESPR, UI, 400, opacity=0.55))

    k.append(text(48, 456, "Type", 18, ESPR, DISPLAY, 700))
    k.append(text(48, 494, "Bricolage Grotesque 700 / 22 — display", 22, ESPR, DISPLAY, 700))
    k.append(text(48, 524, "Inter Tight 600 / 14 — UI label", 14, ESPR, UI, 600))
    k.append(text(48, 548, "Inter Tight 400 / 13 — body & meta", 13, ESPR, UI, 400))
    k.append(text(48, 570, "Inter Tight 400 / 11 — caption", 11, ESPR, UI, 400, opacity=0.6))

    k.append(text(520, 456, "Radius & surface", 18, ESPR, DISPLAY, 700))
    k.append(rect(520, 476, 120, 80, WHITE, rx=R_CARD, stroke=WGRAY, id="radius-14-card"))
    k.append(text(520, 574, "14px — --radius-sticker", 12, ESPR, UI, 400, opacity=0.6))
    k.append(rect(664, 476, 120, 80, WHITE, rx=40, stroke=WGRAY, id="radius-full-pill"))
    k.append(text(664, 574, "full — pills & chips", 12, ESPR, UI, 400, opacity=0.6))

    k.append(text(48, 636, "Placeholder sticker art — on-brand only", 18, ESPR, DISPLAY, 700))
    k.append(text(48, 658, "Retired: #2E7D5B (off-palette green), #12345f (stray navy). "
                           "Brand hexes at varied opacity replace them — no invented hues.",
                  12, ESPR, UI, 400, opacity=0.6))
    for i, (hx, op) in enumerate(ART[:8]):
        x = 48 + i * 74
        k.append(circle(x + 26, 712, 26, hx, opacity=op, id=f"art-tone-{i+1}"))
    return svg("Foundations", W, H, k, bg=CREAM)


# ── artboard 2: components ───────────────────────────────────────────────────

def artboard_components():
    W, H = 1200, 940
    k = [text(48, 64, "Components", 30, ESPR, DISPLAY, 700),
         text(48, 88, "Pieces for the collection-first profile", 13, ESPR, UI, 400, opacity=0.6)]

    k.append(text(48, 140, "Identity row — replaces the 200px banner + 96px avatar", 15, ESPR, DISPLAY, 700))
    k.append(rect(48, 156, 620, 96, WHITE, rx=R_CARD, stroke=WGRAY, opacity=0.5))
    k.append(identity_row(72, 172))

    k.append(text(48, 300, "Collapsed identity chip — sticky state on scroll", 15, ESPR, DISPLAY, 700))
    k.append(group("identity-chip-collapsed", [
        rect(48, 316, 168, 40, "#FFFFFF", rx=20, stroke=WGRAY),
        circle(68, 336, 14, CREAM, stroke="#FFFFFF", sw=2),
        text(68, 341, "A", 12, ESPR, DISPLAY, 600, anchor="middle", opacity=0.55),
        text(90, 341, "angel.g", 14, ESPR, UI, 600),
        rect(190, 331, 10, 10, ESPR, rx=2, opacity=0.4),
    ]))

    k.append(text(48, 412, "Pill tabs — with count badges", 15, ESPR, DISPLAY, 700))
    k.append(pill_row(48, 428, active=0, id="pill-tabs-populated"))
    k.append(text(48, 500, "Empty-category state — dimmed, never hidden", 13, ESPR, UI, 400, opacity=0.6))
    k.append(pill_row(48, 514, pills=[("Collection", "4"), ("Looking For", "0"),
                                      ("Trading Away", "0"), ("Showcase", "0")],
                      active=0, id="pill-tabs-sparse"))

    k.append(text(48, 604, "Sticker card / add tile", 15, ESPR, DISPLAY, 700))
    k.append(sticker_card(48, 620, 0, NAMES[0][0], NAMES[0][1], id="sticker-card-default"))
    k.append(add_tile(258, 620))

    k.append(text(500, 604, "Binder button (existing, top-right)", 15, ESPR, DISPLAY, 700))
    k.append(binder_button(500, 620))
    k.append(text(500, 690, "Keep at top-right. This is why the profile", 12, ESPR, UI, 400, opacity=0.6))
    k.append(text(500, 707, "chip must not live in that corner.", 12, ESPR, UI, 400, opacity=0.6))

    k.append(text(500, 756, "Avatar semantics — the two are different people", 15, ESPR, DISPLAY, 700))
    k.append(circle(516, 800, 16, GOLD, id="rail-chip-your-account"))
    k.append(text(516, 805, "AG", 11, ESPR, UI, 700, anchor="middle"))
    k.append(text(544, 798, "Rail chip = your account (SideBar.tsx:237)", 12, ESPR, UI, 400, opacity=0.7))
    k.append(text(544, 815, "nav affordance, follows you everywhere", 11, ESPR, UI, 400, opacity=0.5))
    k.append(circle(516, 858, 16, CREAM, stroke="#FFFFFF", sw=2, id="identity-avatar-viewed-user"))
    k.append(text(516, 863, "A", 13, ESPR, DISPLAY, 600, anchor="middle", opacity=0.55))
    k.append(text(544, 856, "Identity avatar = the profile you're viewing", 12, ESPR, UI, 400, opacity=0.7))
    k.append(text(544, 873, "page content, changes per route", 11, ESPR, UI, 400, opacity=0.5))
    return svg("Components", W, H, k, bg=CREAM)


# ── artboard 3: dense ────────────────────────────────────────────────────────

def artboard_dense():
    W, H = 1440, 1024
    k = [rail(H), binder_button(W - 136, 36), identity_row(88, 40),
         pill_row(88, 132, active=0), grid(88, 196, 12, cols=6)]
    k.append(text(88, 992, "A — Collection-first, dense. Identity row at rest; "
                           "collection starts 196px down instead of 260px.",
                  12, ESPR, UI, 400, opacity=0.5))
    return svg("A - Collection-first (dense)", W, H, k, bg=CREAM)


# ── artboard 4: sparse ───────────────────────────────────────────────────────

def artboard_sparse():
    W, H = 1440, 1024
    k = [rail(H), binder_button(W - 136, 36),
         identity_row(88, 40, stickers="4", folders="1",
                      bio="New here — just started collecting"),
         pill_row(88, 132, pills=[("Collection", "4"), ("Looking For", "0"),
                                  ("Trading Away", "0"), ("Showcase", "0")], active=0)]
    # Fixed-width cards, justify-start. A stretch-to-fill grid is what actually
    # looks broken at n=4; fixed cards + a trailing add tile read as "early", not "empty".
    kids = []
    for i in range(4):
        label, sub = NAMES[i]
        kids.append(sticker_card(88 + i * (CARD_W + GAP), 196, i, label, sub))
    k.append(group("sticker-grid-sparse", kids))
    k.append(add_tile(88 + 4 * (CARD_W + GAP), 196))
    k.append(text(88, 494, "Cards keep their intrinsic width — no stretch-to-fill. "
                           "Trailing add tile gives the row a terminator.",
                  13, ESPR, UI, 400, opacity=0.6))
    k.append(group("sparse-nudge", [
        rect(88, 528, 604, 92, WHITE, rx=R_CARD, stroke=WGRAY),
        rect(88, 528, 4, 92, GOLD, rx=2),
        text(112, 560, "Your collection is just getting started", 15, ESPR, DISPLAY, 700),
        text(112, 583, "Add stickers to Looking For so traders know what you're after.",
             13, ESPR, UI, 400, opacity=0.65),
        rect(112, 596, 150, 32, BLUE, rx=16),
        text(187, 617, "Set up Looking For", 12, "#FFFFFF", UI, 600, anchor="middle"),
    ]))
    k.append(text(88, 992, "B — Sparse (4 items). The identity row is the reason this page "
                           "still has a subject; a 32px chip alone would leave it empty.",
                  12, ESPR, UI, 400, opacity=0.5))
    return svg("B - Collection-first (sparse)", W, H, k, bg=CREAM)


# ── artboard 5: scrolled / sticky ────────────────────────────────────────────

def artboard_scrolled():
    W, H = 1024, 1024
    k = [rail(H)]
    # grid scrolled under the sticky bar - first row clipped
    k.append(group("sticker-grid-scrolled", [
        sticker_card(88 + (i % 4) * (CARD_W + GAP), 76 + (i // 4) * (CARD_H + GAP),
                     i + 4, NAMES[(i + 4) % len(NAMES)][0], NAMES[(i + 4) % len(NAMES)][1])
        for i in range(12)
    ]))
    k.append(rect(RAIL_W, 0, W - RAIL_W, 64, WHITE, id="sticky-bar-bg"))
    k.append(rect(RAIL_W, 63, W - RAIL_W, 1, WGRAY, id="sticky-bar-border"))
    k.append(pill_row(88, 14, pills=[("Collection", "128"), ("Looking For", "12"),
                                     ("Trading Away", "5"), ("Showcase", "3")], active=0,
                      id="pill-tabs-sticky"))
    k.append(group("identity-chip-sticky", [
        circle(W - 116, 32, 15, CREAM, stroke="#FFFFFF", sw=2),
        text(W - 116, 37, "A", 12, ESPR, DISPLAY, 600, anchor="middle", opacity=0.55),
        text(W - 94, 37, "angel.g", 13, ESPR, UI, 600),
    ]))
    k.append(text(88, 1004, "C — Scrolled. Identity row has collapsed into the sticky bar; "
                            "pills persist. This is the Spotify feel, earned only once content exists.",
                  12, ESPR, UI, 400, opacity=0.5))
    return svg("C - Scrolled (sticky collapse)", W, H, k, bg=CREAM)


BOARDS = {
    "01-foundations.svg": artboard_foundations,
    "02-components.svg": artboard_components,
    "03-collection-first-dense.svg": artboard_dense,
    "04-collection-first-sparse.svg": artboard_sparse,
    "05-scrolled-sticky.svg": artboard_scrolled,
}

if __name__ == "__main__":
    for fn, build in BOARDS.items():
        (OUT / fn).write_text(build(), encoding="utf-8")
        print(f"wrote {fn}")

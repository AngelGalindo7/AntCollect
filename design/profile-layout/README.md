# Profile layout — collection-first exploration

Design exploration for making the user profile page collection-first: replacing the
200px banner + 96px avatar header with a compact identity row, promoting the four
categories to pill tabs, and collapsing identity into a sticky chip on scroll.

## Deliverables

| Where | What |
|---|---|
| Figma | `PetrCollect — Profile Layout` — https://www.figma.com/design/TZCP0BSvwm5UrLnnufsv6x |
| This folder | `*.svg` artboards + `build_artboards.py` that regenerates them |

The SVGs are Figma-importable (plain `rect`/`text`/`path`, no `<style>`, no
`foreignObject`), so each drops in as an editable frame. `id` attributes become
layer names. Regenerate with `python3 build_artboards.py   # from design/profile-layout/`.

## Artboards

1. `01-foundations.svg` — color, type, radius, placeholder art tones
2. `02-components.svg` — identity row, collapsed chip, pill tabs, sticker card, add tile
3. `03-collection-first-dense.svg` — 12 items, 6 columns
4. `04-collection-first-sparse.svg` — 4 items + add tile, the stress case
5. `05-scrolled-sticky.svg` — identity collapsed into the sticky bar

## Decisions

**No top-right avatar chip at rest.** `UserProfile.tsx` already puts the Binder
button at `absolute top-3 right-4`; a chip in that corner collides with it.

**The two avatars are different people, not a duplicate.** `SideBar.tsx:237` renders
`me?.avatar_path` — the signed-in account, a nav affordance. The profile avatar is the
*viewed* user. They only look redundant on your own profile. The identity row keeps
the viewed user inline with content so the distinction reads.

**Identity row at rest, sticky chip on scroll.** Shrinking straight to a 32px chip
breaks the sparse case: a new user with four stickers has no content to carry the
page, and the identity block is the only region guaranteed to be populated. The
collapse-on-scroll version gets the collection-first feel once content exists to
justify it.

**Sparse grid uses fixed-width cards with `justify-start`**, not stretch-to-fill —
four stretched cards is what actually looks broken. A trailing dashed add tile
terminates the row.

## Palette fixes

`#2E7D5B` (off-palette green) and `#12345f` (stray navy) are retired. Neither ever
appeared in `frontend/src` — they were placeholder-art only. Replacements are brand
hexes at varied opacity; no new hues were introduced. `#12345f` → `#0F2D5C`.

## Known gaps

- **Inter Tight is not installed in Figma** — the file uses `Inter` as a stand-in for
  all UI text. Bricolage Grotesque is available and used as-is. Swap via Figma's font
  replace once Inter Tight is added to org fonts.
- **Figma file is partial.** Built: token variable collection (9 colors, 2 radii) and
  the Foundations frame. Not yet built: Components frame and the three layout frames —
  the Figma MCP connection dropped mid-session.
- **Bug to fix on resume:** in the Foundations frame the placeholder art-tone ellipses
  all read `opacity: 1`. `figma.variables.setBoundVariableForPaint()` returns a *new*
  paint and drops a paint-level `opacity` set beforehand. Set `opacity` on the returned
  paint, after binding, not before.

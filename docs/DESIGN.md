# Small Farmer — Design Language

Calm, precise, native-feeling. The app should feel like a first-party system app: content first,
chrome recedes, nothing decorative that doesn't carry meaning. Inspired by platform Human Interface
conventions (clarity, deference, depth) — **no third-party brand names, logos or trademarked assets.**

## Principles
1. **Deference.** Content is the hero. Bars are translucent, separators hairline, colour is reserved for meaning and the single tint.
2. **Clarity.** One clear Large Title per screen. Secondary text is genuinely secondary (grey), never a second accent.
3. **Depth.** Layers: grouped background → raised cells/cards → translucent bars → sheets. Shadows are rare and soft.
4. **Restraint.** One tint colour (leaf green). Module colours appear only inside small rounded icon tiles.
5. **Direct manipulation.** Every row that does something looks tappable (chevron, tint text, or filled button); press states respond instantly.

## Tokens (all in `src/styles/tokens.css`; never hard-code colours)
| Token | Use |
|---|---|
| `--bg` | grouped page background (light #F2F2F7, dark #000) |
| `--bg-elevated` | cells, cards, widgets (light #FFF, dark #1C1C1E) |
| `--bg-elevated-2` | inputs/fills on top of cells (light #F2F2F7-ish, dark #2C2C2E) |
| `--fill` | subtle control fills (segmented, search field) |
| `--label`, `--label-2`, `--label-3` | primary / secondary / tertiary text. `--label-2` is ≥ 4.5:1 on every surface (light alpha .76); `--label-3` is for placeholders, chevrons and decoration only, never for text that must be read |
| `--separator` | hairlines between rows, inset to the text start via `--sep-inset` (16px; 58px after a `.tile`; 72px after a `.tile-lg` or `.dash-cal`) — one rule in `base.css` for every `.group` |
| `--tint`, `--tint-soft`, `--on-tint` | accent (buttons, links, selection), its 12% wash, text on tint. Light #176F2C (6.3:1 on white, ≥ 4.5:1 on `--bg`, `--tint-soft` and the sidebar), dark #34C759 |
| `--red`, `--orange`, `--yellow`, `--green`, `--blue`, `--indigo`, `--purple`, `--brown`, `--teal` | semantic fills + icon tiles |
| `--red-text`, `--orange-text` | the same meanings as **text** (errors, negative money, badges, late dates); ≥ 4.5:1 on their own 15–16% wash. Never use `--red`/`--orange` for text |
| `--bar-bg` | translucent bar fill used with `backdrop-filter: saturate(180%) blur(20px)` |
| `--r-sm` 8 / `--r-md` 12 / `--r-lg` 16 / `--r-xl` 22 | radii |
| `--font`, `--font-rounded`, `--font-mono` | system text, rounded numerals, mono |

## Type scale (classes in `base.css`)
`.t-large` 34/41 bold · `.t-title2` 22/28 bold · `.t-title3` 20/25 semibold · `.t-headline` 17/22 semibold ·
`.t-body` 17/22 · `.t-callout` 16/21 · `.t-subhead` 15/20 · `.t-footnote` 13/18 · `.t-caption` 12/16.
Numbers in widgets use `--font-rounded` + `tabular-nums`.

## Building blocks (in `base.css` — reuse, don't reinvent)
- **Page**: `<div className="page">` then `<header className="page-head"><h1 className="t-large">…</h1><p className="page-sub">…</p></header>`.
- **Section**: `<section className="section"><h2 className="section-title">CAPS-STYLE TITLE</h2> …group… <p className="section-foot">footnote</p></section>`.
- **Inset grouped list**: `<ul className="group">` with `<li className="cell">` rows. A tappable row is `<Link|button className="cell cell-link">`.
  Row anatomy: `<span className="tile" style={{"--tile": "var(--green)"}}><Icon name="leaf"/></span><span className="cell-body"><span className="cell-title">…</span><span className="cell-sub">…</span></span><span className="cell-value">…</span><Icon name="chevron" className="chev"/>`.
- **Card / widget**: `.card` (padding 16, radius 16, elevated bg, no border, no shadow in light — depth from colour).
- **Buttons**: `.btn` (filled tint, 50px tall, radius 14, full-width on phones when primary), `.btn-tinted` (tint-soft bg, tint text), `.btn-plain` (text only, tint), `.btn-sm` (capsule 30px), `.btn-destructive` (red text / or filled red with `.btn.btn-danger`), `.icon-btn` (36px circle).
- **Forms**: inside a `.group`, each field is `<label className="field"><span className="field-label">Label</span><input className="field-input"/></label>`; hairline between fields; no boxed inputs inside groups.
- **Segmented control**: `.segmented` with `<button aria-pressed>` children.
- **Search field**: `.search-field` with leading magnifier icon.
- **Empty state**: `.empty` with large tinted icon, `.t-title3` heading, footnote text.
- **Pills/badges**: `.badge` (+ `.badge-red/orange/green/grey`).
- Icons: `import Icon from "../components/Icon"` → `<Icon name="leaf" />` (24-grid line icons, 1.75 stroke, `currentColor`). Never use emoji as UI icons.

## Layout
- Phone (< 900px): translucent top bar (compact title appears once the Large Title scrolls away), bottom tab bar (translucent, 49px + safe area).
- Wide (≥ 900px, e.g. the installed Windows app): left **sidebar** (260px, translucent) replaces the tab bar; content column max 720px, centred in the remaining space.
- Side gutters: 16px phone, 20px ≥ 600px. Grouped lists are inset (rounded) at every size.

## Motion
Subtle and quick: 180–240ms, `cubic-bezier(.2,.8,.2,1)`. Page content fades/rises 6px on route change, buttons scale to .97 on press,
rows highlight on press. Everything disabled under `prefers-reduced-motion: reduce`.

## Accessibility
Text contrast ≥ 4.5:1 (tint text uses the darker tint in light mode). Hit targets ≥ 44px. Visible focus ring
(`:focus-visible` 2px solid `--tint` outline, offset 2px; inside a `.group` it is drawn inset at -2px so the group's
`overflow: hidden` can't clip it). Compact controls (top-bar EN/BM) keep their small look but get an invisible 44px
`::after` hit area. Icons that carry meaning have `aria-label`; decorative icons `aria-hidden`.

## Copy
Sentence case. Section titles short. Keep all text in `src/i18n/en.ts` + `ms.ts` (Malay must stay complete).

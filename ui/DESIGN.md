# StarCi Operations Center — visual language

The interface is a read-only operations product. It keeps the operational story visible and gives technical detail a consistent home in **Nâng cao**. The visual direction reference is `D:/starci-tmp/hfs/f4-handover/ui-purify/visual-direction.png`; its example data is illustrative only.

## Tokens

- **Surfaces:** `--background` is the page canvas, `--card` the single raised reading surface, `--sidebar` the navigation chrome, and `--muted` a quiet hover or table header. Light uses near-white neutrals; dark uses distinct charcoal layers. Nesting does not add another boxed surface.
- **Ink and lines:** `--foreground` carries primary text, `--muted-foreground` secondary facts, `--border` a solid hairline, `--input` a control edge, and `--ring` an unmistakable focus outline. Links and navigation use neutral ink. Shadows are absent in normal content.
- **Status:** success green, running blue, queued neutral, failure/blocked red, retry/warning amber, awaiting owner violet. Deferred/skipped/planned may use dashed treatment. Semantic text colors must keep at least 4.5:1 contrast on their surfaces. File types and decoration stay neutral.
- **Radius:** 12px for cards and drawers, 8px for controls, full radius for status pills. The border belongs to the outer surface only.
- **Type:** Geist, page 28/34 (24 on phones), section 20/28 (18 on phones), card 16/24, body 14/22, meta 13/20, small 12/18. Weights are 650/620/600/400 respectively. Figures use tabular numerals; monospace is reserved for paths, identifiers, commands and raw evidence.
- **Space:** 4/8/12/16/24/32px. Page sections use 32px (24 on phones), outer cards 24px (16 on phones), drawer 24px (16 on phones), and list/table rows at least 44–48px. Stacked regions share a left edge.

## Component anatomy

- **Page header:** optional quiet breadcrumb, one title, one descriptive line, then actions or facts. One primary status pill is enough in a header; related counts appear as plain secondary text.
- **Card:** one surface and one solid border. Inner groups use spacing or a hairline. A nested card is flattened.
- **Nâng cao:** inline uses a solid top hairline; standalone card uses one outer surface. Its summary is a compact preview, never an extra status chip.
- **Status pill:** small dot, short label, semantic ink and soft background. Every other fact in a row is quiet text.
- **Table/list:** 44px header, 48px body rows, neutral header surface, no zebra fill, subtle hover, right-aligned terminal numeric cell, truncation with title where needed. Mobile lists stack label and value without page overflow.
- **Drawer:** one bounded surface; header and body have consistent padding. Inner sections are separated by space, not more borders.
- **Pipeline node:** human name first; status and progress second; agent and attempt dots share a footer. The active leg has one clear outline. Edges are quiet and dashed only for deferred semantics. Wide graphs scroll in their container.
- **Empty/loading/error:** icon, one sentence, optional retry/action. Skeleton blocks match the dimensions of the final content. Error uses the failure tone once, with a direct retry where available.

## Motion

Use `motion/react` primitives for a 150–250ms entrance, disclosure or press response. Respect reduced motion. The only repeated animation is the shell's live dot. No decorative lift or pulsing cards.

## Do / don't

Do preserve data, labels, links and deep links. Do use one hierarchy across all pages and both themes. Don't stack cards, sprinkle dashed lines, tint file types, animate static status markers, or promote IDs above human names.

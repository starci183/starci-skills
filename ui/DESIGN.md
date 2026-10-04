# StarCi Operations Center — visual language

The interface is a read-only operations product. It keeps the operational story visible and gives technical detail a consistent home in its "Advanced" section (Vietnamese label). Local shadcn/ui primitives use the Radix implementation, with cmdk for keyboard search. The component layer keeps the original page hierarchy, navigation, graph identity, density and semantic status system. Its neutral zinc chrome follows the owner-selected Vercel direction. The bundled StarCi mark and provider marks retain their identity. Design mockups contain illustrative data; fresh implementation captures establish rendered behavior.

## Tokens

- **Surfaces:** `--background` is the page canvas, `--card` the single raised reading surface, `--sidebar` the navigation chrome, and `--muted` a quiet hover or table header. Light uses near-white neutrals; dark uses distinct charcoal layers. Nesting does not add another boxed surface.
- **Ink and lines:** `--foreground` carries primary text, `--muted-foreground` secondary facts, `--border` a solid hairline, `--input` a control edge, and `--ring` a visible neutral focus outline. Primary controls use dark ink in light mode and light ink in dark mode; `--accent` is a neutral hover surface. Operational state uses its own semantic colors. Shadows are absent in normal content.
- **Status:** success green, running blue, queued neutral, failure/blocked red, retry/warning amber, awaiting owner violet. Deferred/skipped/planned may use dashed treatment. Semantic text colors must keep at least 4.5:1 contrast on their surfaces. File types and decoration stay neutral.
- **Radius:** 12px for cards and dialogs, 8px for controls, full radius for status pills. Side Sheets have square exterior edges. The border belongs to the outer surface only.
- **Type:** Geist, page 28/34 (24 on phones), section 20/28 (18 on phones), card 16/24, body 14/22, meta 13/20, small 12/18. Weights are 650/620/600/400 respectively. Figures use tabular numerals; monospace is reserved for paths, identifiers, commands and raw evidence.
- **Space:** 4/8/12/16/24/32px. Page sections use 32px (24 on phones), outer cards 24px (16 on phones), drawer 24px (16 on phones), and list/table rows at least 44–48px. Stacked regions share a left edge.

## Component anatomy

- **Page header:** optional quiet breadcrumb, one title, one descriptive line, then actions or facts. One primary status pill is enough in a header; related counts appear as plain secondary text.
- **Attempt:** preserve the header, recorded lifecycle milestones, Op/Outcome/Products and Advanced hierarchy. Place the checkpoint receipt inside Outcome before the recorded verdict, retain workflow integration separately, and label the recorded commit action explicitly. Attempt lifecycle marks navigate recorded facts; the Workflow Op DAG represents dependencies.
- **Card:** one surface and one solid border. Inner groups use spacing or a hairline. A nested card is flattened.
- **Advanced (Vietnamese label):** inline uses a solid top hairline; standalone card uses one outer surface. Its summary is a compact preview, never an extra status chip.
- **Status pill:** small dot, short label, semantic ink and soft background. Every other fact in a row is quiet text.
- **Table/list:** 44px header, 48px body rows, neutral header surface, no zebra fill, subtle hover, tabular numerals, truncation with title where needed. Mobile lists stack label and value without page overflow; long prose uses a full-width field.
- **Code evidence:** Text, JSON, YAML and source Diff frames use `evidence-code-frame` with shared dark scoped tokens in both themes. Media keeps its media frame; typed Transcript and Log product surfaces use the selected theme.
- **Drawer:** Radix-backed Sheet with a 480px desktop surface and full-width, full-height mobile surface. Header and scrollable body have consistent padding. Inner sections are separated by space. Focus is trapped while open; Escape and the labeled close button dismiss it.
- **Pipeline node:** human name first; status and progress second; agent and attempt dots share a footer. The active leg has one clear outline. Edges are quiet and dashed only for deferred semantics. Wide graphs scroll in their container.
- **Empty/loading/error:** icon, one sentence, optional retry/action. Skeleton blocks match the dimensions of the final content. Error uses the failure tone once, with a direct retry where available.

## Primitive source

The local primitives are adapted from the official [shadcn/ui Radix components](https://ui.shadcn.com/docs/components/radix/button) and [Radix Vega registry](https://ui.shadcn.com/r/styles/radix-vega/button.json), read on 2026-10-03. `components.json` selects this implementation and the zinc palette. The upstream MIT notice is retained in `src/components/ui/LICENSE.md`. Shared Tailwind variants map Radix states and orientation to the registry's state classes. Application DAGs, agent identity and mobile bottom navigation remain product compositions.

## Motion

Use `motion/react` primitives for a 150–250ms entrance, disclosure or press response. Respect reduced motion. The only repeated animation is the shell's live dot. No decorative lift or pulsing cards.

## Do / don't

Do preserve data, labels, links and deep links. Do use one hierarchy across all pages and both themes. Don't stack cards, sprinkle dashed lines, tint file types, animate static status markers, or promote IDs above human names.

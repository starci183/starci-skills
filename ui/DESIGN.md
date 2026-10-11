# StarCi Operations Center — visual language

The interface is a read-only operations product. HeroUI React compounds own its controls, collections, disclosures and overlays. Thin local adapters preserve the existing call sites while delegating anatomy, keyboard behavior and focus to the installed vendor components. The component layer keeps the page hierarchy, navigation, graph identities and semantic status system. Human titles and recorded states precede source facts; technical detail belongs in the shared Accordion. Bundled StarCi and provider assets retain their identity. Design mockups contain illustrative data; fresh implementation captures establish rendered behavior.

## Tokens

- **Surfaces:** `--background` is the canvas, `--surface` the reading surface and `--sidebar` navigation chrome. `--default` is a neutral fill; `--muted` is secondary ink. Vendor aliases resolve inside each light, dark and code-evidence scope. Nesting uses transparent Card variants and spacing.
- **Ink and lines:** `--foreground` carries primary text, `--muted` secondary facts, `--border` separators and `--field-border` input edges. HeroUI owns focus anatomy through `--focus`. Primary controls use neutral `--accent` ink and its contrasting foreground. Operational state has its own semantic colors.
- **Status:** success green, running blue, queued neutral, failure/blocked red, retry/warning amber, awaiting owner violet. Deferred/skipped/planned may use dashed treatment. Semantic text colors must keep at least 4.5:1 contrast on their surfaces. File types and decoration stay neutral.
- **Radius:** vendor compounds own radius and border anatomy. The side Drawer has square exterior edges; selection outlines identify current or selected graph nodes.
- **Type:** Geist, page 28/34 (24 on phones), section 20/28 (18 on phones), card 16/24, body 14/22, meta 13/20, small 12/18. Weights are 650/620/600/400 respectively. Figures use tabular numerals; monospace is reserved for paths, identifiers, commands and raw evidence.
- **Space:** 4/8/12/16/24/32px. Page sections use 32px (24 on phones), outer cards 24px (16 on phones), drawer 24px (16 on phones), and list/table rows at least 44–48px. Stacked regions share a left edge.

## Component anatomy

- **Page header:** optional quiet breadcrumb, one title, one descriptive line, then actions or facts. One primary status pill is enough in a header; related counts appear as plain secondary text.
- **Attempt:** preserve the header, recorded lifecycle milestones, Op/Outcome/Products and Advanced hierarchy. Place the checkpoint receipt inside Outcome before the recorded verdict, retain workflow integration separately, and label the recorded commit action explicitly. Attempt lifecycle marks navigate recorded facts; the Workflow Op DAG represents dependencies.
- **Card:** native borderless Card with Header, Content and Footer. Root inset is 24px on desktop and 16px on mobile; Content has no second inset. Embedded sections use the transparent variant or `inset="none"`.
- **Advanced (Vietnamese label):** actual Accordion compounds with the default vendor Indicator. Its summary is a compact preview. Read failures, goal approval and recorded-state facts remain visible outside a collapsed panel. Lazy mounting and explicit keep-mounted behavior retain their original purpose.
- **Status pill:** small dot, short label, semantic ink and soft background. Every other fact in a row is quiet text.
- **Table/list:** 44px header, 48px body rows, neutral header surface, no zebra fill, subtle hover, tabular numerals, truncation with title where needed. Mobile lists stack label and value without page overflow; long prose uses a full-width field.
- **Code evidence:** Text, JSON, YAML and source Diff frames use `evidence-code-frame` with shared dark scoped tokens in both themes. Media keeps its media frame; typed Transcript and Log product surfaces use the selected theme.
- **Drawer:** native Backdrop, Content, Dialog, Header, Body and CloseTrigger, with a 480px desktop surface and full-width mobile surface. Body owns scrolling. Native focus trapping, Escape and return focus remain intact. Modal and Drawer portals carry their requested preview theme.
- **Pipeline node:** human name first; status and progress second; agent and attempt dots share a footer. The active leg has one clear outline. Edges are quiet and dashed only for deferred semantics. Wide graphs scroll in their container.
- **Empty/loading/error:** icon, one sentence, optional retry/action. Skeleton blocks match the dimensions of the final content. Error uses the failure tone once, with a direct retry where available.

## Component source

The installed HeroUI React and styles packages own component APIs and anatomy. Official [HeroUI MCP documentation](https://heroui.com/en/docs/react/getting-started/mcp-server), component documents and theme variables were queried on 2026-10-09 and checked against installed declarations. Search uses Modal, Autocomplete, SearchField and ListBox. Domain graphs and charts draw SVG data geometry; their navigation uses actual HeroUI HTML links and buttons. Native media playback retains the browser's audio/video capability.

## Motion

Use `motion/react` primitives for a 150–250ms entrance, disclosure or press response. Respect reduced motion. The only repeated animation is the shell's live dot. No decorative lift or pulsing cards.

## Do / don't

Do preserve data, labels, links and deep links. Do use one hierarchy across all pages and both themes. Don't stack cards, sprinkle dashed lines, tint file types, animate static status markers, or promote IDs above human names.

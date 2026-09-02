# StarCi Core component matrix

All public renderers and prop types come from `@starci/grammar/common`. Core replaces only `GrammarRoot`; every other renderer is inherited and receives Core visual DNA through scoped CSS.

| Common renderer | Common contract | Core realization | Applicable UI rules and StarCi idioms |
| --- | --- | --- | --- |
| `GrammarRoot` | Neutral div/theme boundary | `CoreGrammarRoot` installs family scope | TONE-1, A11Y-4 |
| `PageContainer` | Product/reading/full measure and page inset | Core binds measures and spacing aliases | LAYOUT-1, MARGIN-1, PADDING-2 |
| `Badge` | Short named identity/status tone | Core maps neutral/accent/state tones | TONE-2, STATE-1 |
| `Button` | Native command/submit, visible label, pending lock | Core maps size/variant; danger variant is a Common gap | ACTION-1..2, CTA-1..5 |
| `Divider` | Separator with optional visible label | Core binds separator material | BOUNDARY-5 |
| `Heading` | Explicit HTML level and visual scale | Core binds typography without changing rank | FONT-1, FONT-4 |
| `Icon` | Role-based decorative or named glyph | Core binds geometry and tone | TONE-2 |
| `IconTile` | Stable identity/state icon plate | Core binds size/tone/radius | ACCENT-2, MEASURE-2 |
| `IconButton` | Native icon command with required label | Core binds target and focus | A11Y-2 |
| `Label` | Visible name for field/region | Core binds typography only | A11Y-1, FONT-3 |
| `Input` | Label, value, hint/error, validity and disabled state | Core binds field material | FEEDBACK-1, Single-column form stack |
| `Progress` | Named measurable value 0..100 | Core binds track/fill | A11Y-3, ACCENT-4 |
| `Text` | Semantic element, size/tone/weight/live/skeleton | Core binds type; missing standalone recipes remain Common gaps | FONT-1..5, TRUTH-1 |
| `TextAction` | Button semantics with link-like appearance and pending lock | Core shares action styling | ACTION-1..3 |
| `SectionHeader` | Eyebrow/title/description/action hierarchy | Core binds type and rhythm | HIERARCHY-1..3 |
| `MediaFrame` | Aspect/fit/treatment/caption/frame | Core binds family material; loading/error prop is a Common gap | Generated art is a band, not a card |
| `IncludedMark` | Decorative included-offering mark | Core binds 20px geometry; never claims completion | TRUTH-1 |
| `RankArtwork` | Purpose-named decorative rank art | Core presents; feature resolves truth | TRUTH-2 |
| `SurfaceCopyGroup` | Compact title/explanation rhythm | Core binds rhythm; exact 4px recipe is a Common gap | FONT-3, GAP-1, Title and one supporting line |
| `PrimaryRailLayout` | Anonymous primary/rail composition | Core binds tracks and stacking | LAYOUT-2, RESPONSIVE-2 |
| `NavigationFeatureNav` | Anonymous primary/compact navigation projection | Core binds breakpoints and separators | RESPONSIVE-2..3 |
| `Sidebar` | Grouped rail/drawer with selection/collapse callbacks | Core binds family appearance; product owns routes/persistence | LAYOUT-2, STATE-2 |
| `WorkspaceShell` | Anonymous navigation/primary/rail/header/floating layout | Core binds responsive grid and zero-footprint absence | LAYOUT-2..4, RESPONSIVE-3 |
| `ChatWorkspace` | Conversation/composer/rail with drawer projection | Core binds scroll/responsive rail | LAYOUT-2..4, RESPONSIVE-2 |
| `StateMark` | Compact presentation-state carrier | Core maps state treatment | STATE-1 |
| `LeadingNumber` | Ordered leading number anatomy | Core keeps it visually quiet | HIERARCHY-3 |
| `OtpInput` | Grouped one-time-code field | Core binds field geometry | Single-column form stack |
| `StaticStateRow` | Non-command row for one verified state | Core maps presentation state | TRUTH-2, STATE-1 |
| `EmptyNotice` | Empty/failed/unavailable notice with optional action | Core presents; feature owns truth/recovery | FEEDBACK-2, STATE-1 |
| `HorizontalScrollRegion` | Single reachable horizontal overflow owner | Core keeps chrome quiet without disabling scroll | MEASURE-4, RESPONSIVE-4 |
| `VerticalScrollRegion` | Single reachable vertical overflow owner | Core preserves containment/focus | LAYOUT-3, MEASURE-4 |
| `SurfaceCard` | Label/state/depth/frame/scroll/composition/whole action | Core paints labelled cards as one label-inside material box | Joined bands in one flush card, One highlighted card |
| `SurfaceListCard` | Labelled repeated-peer collection | Core binds shared seams/material | GAP-3, Joined bands in one flush card |
| `FencedCodeBlock` | Semantic code boundary and overflow | Core binds code material | MEASURE-4 |
| `MarkdownArticle` | Semantic prose rhythm/reading owner | Core binds reading measure/type | FONT-1, MARGIN-1 |
| `MarkdownTableFrame` | Reachable table overflow frame | Core binds boundary/scroll | MEASURE-4 |
| `SurfaceAccordionCard` | Controlled disclosure with stable geometry | Core binds state/focus | STATE-3, STATE-1 |
| `Rail` | Named auxiliary header/body/footer/scroll region | Core binds sticky/contained behavior | LAYOUT-2..3 |
| `Subnav` | Compact/sticky identity and toggle region | Core binds visibility and target | RESPONSIVE-2..3, FOCUS-1 |
| `Tabs` | Controlled persistent peer-view selection | Core binds indicator/overflow/focus | STATE-2 |
| `Tooltip` | Supplementary description for an existing control | Core styles it; never replaces the accessible name | A11Y-2 |

## Support contracts

Common also exports presentation-state guards, form/scroll class-name helpers, `COMMON_SPACING_SCALE`, `COMMON_SPACING_TOKENS`, `COMMON_UI_RULE_IDS`, and family/conformance factories. They are support contracts, not extra visual components.

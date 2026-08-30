# Grammar Common semantic composition catalog

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-semantic-composition` |
| Contract revision | `7.4.0` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence, direction-generate, contract-freeze` |
| Search tags | `semantic composition, anatomy, pattern catalog, grammar filter, ownership` |
| Dependencies | `fe.grammar-common-capabilities, fe.grammar-common-extension` |

Semantic composition patterns turn product-neutral roles into a closed anatomy before layout or
styling is implemented. Business authority decides which information and actions exist. Grammar
decides their ordered slots, owner, cardinality, responsive transformation, and selected-package
treatment. A brainstorm is only a hypothesis until every visible role is normalized through this
catalog and the routed package proves the referenced export, pattern, case, or token.

## Contract layers

```text
semantic tokens -> primitives -> semantic composition patterns -> layout patterns -> application blocks/composites
```

Do not skip a layer by reconstructing it in application CSS. `available` means an exact public package
interface exists. `adapter` means application code may bind product data without changing the closed
anatomy. `proposal` is a review packet only and cannot be imported, rendered, ranked, or implemented.
`approved-publication` means the teacher explicitly approved that exact generic anatomy but its export
may still be pending. `grammar-gap` blocks implementation until the package publishes the missing
approved interface.

## Grammar and application ownership

Every visible application element binds to published Grammar authority: semantic HTML behavior,
typography hierarchy, action treatment, spacing, surface, collection, layout, responsive behavior,
focus, scroll, sticky, resize, and overlay lifecycle. Application code may not recreate a generic
button, heading/description stack, field, card surface, listbox, navigation shell, rail, or workspace
with local utility classes.

Business-derived creativity stays in an application `block` or `composite`. For example, a course
card may own course media, price, progress, instructor facts, business ordering, permissions, copy,
analytics, and route destinations. Its button, media frame, copy hierarchy, surface and responsive
behavior still bind to published Grammar primitives and compositions. A business block is not a
back door for a second visual system.

A new generic pattern is never published from agent initiative. The agent first emits a proposal
that names its product-neutral anatomy, alternatives, consumers, invariants and migration cost, then
waits for explicit teacher approval. Only that exact approved proposal may move to
`approved-publication`; material anatomy changes require a new approval. Product-specific blocks do
not need Grammar promotion approval because they remain application-owned, but they must provide a
complete Grammar binding manifest.

## Copy, identity, and action patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `ContextIntro` | required eyebrow -> required contextual heading -> required supporting description | available as the `SectionHeader` context-intro composition |
| `SectionHeader` | optional eyebrow -> required heading -> optional description -> optional peer action | available |
| `SurfaceCopyGroup` | required title -> optional explanation; a stronger boundary precedes any external action | available |
| `ActionGroup` | one dominant action -> optional secondary/tertiary actions owned by the same decision | grammar-gap |
| `BreadcrumbTrail` | ancestor destinations -> current location, with declared compact fallback | adapter |

## Field and choice patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `FormField` | label -> optional description -> control -> stable helper/validation region | adapter; package generalization pending |
| `Listbox` | accessible label -> selectable options -> selected/focus state -> optional empty/loading owner | adapter; exact selected-package export required |
| `DestinationList` | group label -> destination rows -> current/expanded/disabled state | adapter |
| `PeerTabs` | tablist -> mutually exclusive tabs -> associated panel | available |
| `SegmentedChoice` | label -> mutually exclusive in-place choices -> selected state | grammar-gap when substituted with Tabs |

## Surface, collection, and data patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `SurfaceCard` | optional external/owned label -> coherent body -> optional facts/status -> optional action | available |
| `SurfaceListCard` | label/fact/action -> one joined collection -> empty/loading/error owner -> optional footer | available |
| `DisclosureList` | labelled owner -> repeated trigger/panel rows -> one separator owner | available |
| `StateRow` | state mark -> identity -> optional description/fact/action | available |
| `PressableSurface` | one native destination/action over one coherent surface boundary | adapter |
| `MetricGroup` | repeated value -> label pairs with one comparison owner | grammar-gap |
| `ProgressSummary` | label/value -> progress presentation -> optional supporting fact/recovery | grammar-gap |
| `DataTable` | caption/label -> headers -> comparable rows/cells -> state/selection/action owner | adapter |
| `MediaFrame` | media viewport -> optional caption/alternative intent | available |
| `Article` | semantic document hierarchy -> figures/code/tables under one reading owner | adapter |

## State, feedback, and overlay patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `RegionState` | state identity -> explanation -> optional recovery action | adapter |
| `InlineFeedback` | consequence/status -> explanation -> optional recovery owned by the affected region | grammar-gap |
| `DialogSurface` | title -> description -> body -> action region, with focus lifecycle | adapter |
| `DrawerSurface` | title -> description -> bounded body -> terminal action region, with focus lifecycle | adapter |
| `PopoverSurface` | anchor -> lightweight explanation/action set -> collision fallback | grammar-gap |

## Layout patterns

| Pattern | Regions and behavior | Status |
| --- | --- | --- |
| `PageContainer` | one page measure and inset owner | available |
| `PrimaryRailLayout` | dominant primary region + subordinate rail; stacks by declared container rule | available |
| `RightRail` | complementary right rail whose content owns `space.inline.3` and `space.block.6`; flow/sticky is explicit | available through `PrimaryRailLayout + Rail[inset=content]` |
| `StickySummaryLayout` | primary task + derived summary with one scroll owner, collision stop, and compact fallback | available as a named case |
| `ResizableRailLayout` | persistent rail + separator + min/default/max width + keyboard/pointer lifecycle + compact fallback | grammar-gap |
| `ThreePaneWorkspace` | navigation/outline + primary editor/task + preview/support with explicit scroll owners | grammar-gap |
| `SplitWorkbench` | two task peers with explicit responsibility, resize/scroll, and compact view switch | grammar-gap |
| `BoundedScrollRegion` | one bounded viewport and restoration owner | package export gap for vertical form |
| `StickyTerminalBar` | one terminal action owner pinned to an edge with safe-area clearance | grammar-gap |
| `HeroIntro` | one reading anchor + optional decision group + purposeful media anchor | adapter; selected package case required |

## Shell and navigation patterns

| Pattern | Regions and behavior | Status |
| --- | --- | --- |
| `ExtendedNavbar` | brand + primary destinations + required compact projection + global utilities + optional subordinate section navigation | approved-publication; `request:current#ExtendedNavbar` |
| `NavigationSidebar` | optional identity/summary + labelled destination groups + optional footer | grammar-gap; candidate interface |
| `UtilityCluster` | search + locale + theme + commerce + notifications + account, ordered by responsive priority | adapter |
| `IdentitySummary` | avatar/mark + identity + optional account facts + disclosure | adapter |
| `CollapsibleNavigationRail` | expanded/collapsed navigation with one width, padding, focus, tooltip, and motion owner | grammar-gap |
| `ResizableNavigationRail` | navigation rail + separator + min/default/max size + keyboard/pointer resize + compact fallback | grammar-gap |
| `BreadcrumbHeader` | breadcrumb trail + context identity + optional peer actions | adapter |
| `MobileNavigationFallback` | compact trigger + modal/drawer destination tree + focus restoration | adapter |

## Dashboard and activity patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `DashboardShell` | ExtendedNavbar -> optional NavigationSidebar -> primary dashboard regions -> optional supporting rail -> global assistants | approved-publication; `request:current#DashboardShell` |
| `MetricStrip` | repeated value-label pairs under one comparison owner | grammar-gap |
| `TaskChecklist` | section identity -> actionable rows -> completion hint/reward | adapter |
| `ContinueLearningRail` | section identity -> resumable learning cards -> overflow owner | adapter |
| `ActivityStreak` | period markers -> current marker -> streak fact/badge | adapter |
| `GoalProgressGroup` | summary -> repeated goal metrics/progress -> edit/recovery action | adapter |
| `ActivityFeed` | feed identity -> typed activity rows -> pagination/empty/loading owner | adapter |
| `RecommendationRail` | labelled recommendations -> repeated destination cards -> overflow owner | adapter |
| `LeaderboardSummary` | standing identity -> ranked rows -> destination to full ranking | adapter |

## Conversation and assistant patterns

| Pattern | Ordered anatomy | Status |
| --- | --- | --- |
| `FloatingLauncher` | leading visual + accessible label + optional status + controlled open action | grammar-gap; keep product adapter until drag/focus/collision proof closes |
| `ChatWidget` | launcher -> anchored conversation surface -> compact/expanded state -> close/focus return | grammar-gap |
| `ChatWorkspace` | optional history/navigation rail -> conversation header -> context? -> one transcript scroll owner -> status? -> composer dock -> optional context/support rail | approved-publication; `request:current#ChatWorkspace` |
| `ConversationWorkspace` | conversation header -> context? -> one transcript scroll owner -> status? -> composer dock | proposal; narrower alias must not publish independently without approval |
| `MessageTranscript` | labelled chronological messages -> streaming/pending marker -> load-history boundary | adapter |
| `MessageBubble` | author/state identity -> message body -> optional evidence/actions -> delivery state | adapter |
| `PromptComposer` | label -> editable prompt -> attachments/tools? -> send/stop action -> validation/status | grammar-gap |
| `AssistantDrawer` | assistant identity -> bounded ChatWorkspace -> terminal controls, with focus lifecycle | adapter |
| `ContextAttachmentTray` | attached context/evidence items -> remove/inspect actions -> capacity/error state | grammar-gap |
| `SuggestedPromptList` | labelled starter prompts -> native action rows -> loading/empty owner | adapter |

Promotion eligibility: a product block may be proposed only after at least two consumers share its
semantic anatomy, or one consumer exposes a platform-level invariant such as landmarks, focus,
resize, sticky, scroll, responsive fallback, or restoration. Eligibility is not publication
authority: explicit teacher approval is still required. Visual similarity alone never promotes a
block. Grammar owns product-neutral anatomy and behavior; product code continues to own data, copy,
permissions, route destinations, business states, analytics, and business-specific composition.

Newly approved and published Core interfaces still require consumer adaptation proof before being called stable:
the adapter removes the predecessor's duplicate landmark, scroll, focus, sticky, or spacing owner;
wide/intermediate/compact behavior is exercised; and optional-slot tests prove layout ownership does
not shift. Until then the interface is a `candidate export`, not evidence that migration is complete.

## Grammar filter

Every brainstorm candidate must first declare semantic roles and owners, then bind every required
decision to exactly one catalog pattern plus one selected-package export/case/token. Rejected
candidates are not rendered or ranked. A candidate is rejected when it:

- uses an unnamed composition, raw class, pixel, palette name, or visual resemblance as authority;
- changes required anatomy, order, cardinality, owner, scroll, sticky, selection, or responsive behavior;
- references a `grammar-gap` as if it were implemented;
- mixes selected Grammar packages;
- leaves any visible role or responsive state without a manifest decision.

A candidate is also rejected when it attempts to publish an unapproved proposal, places reusable
visual anatomy inside an application block, or places business-specific meaning inside Grammar.

Fewer than three materially distinct grammar-valid directions is a Grammar gap, not permission to pad
the set with color, spacing, or decoration variants.

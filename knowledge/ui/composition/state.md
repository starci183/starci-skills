# State composition

This file answers one question: which distinct conditions can this feature be in, and which
published carrier holds each one?

State is compiled before anything renders. The direction lists the business facts and the
transitions between them first, then binds each to a real carrier. Two facts that share a carrier
become one fact, and a fact with no carrier becomes a guess, so the compiling step is the rule.

## The five kinds

| Kind | Examples | Nature |
| --- | --- | --- |
| Transient cue | hover, focus, pressed | Lasts only while the input lasts |
| Persistent value | selected, expanded | Survives blur, rerender, and reflow |
| Lifecycle fact | unavailable, pending, initially unresolved | Follows the work, not the pointer |
| Settled outcome | success, error, cancellation | Requires a real result from authority |
| Absence | the branch does not exist | Contributes nothing at all |

`PresentationState` publishes `neutral`, `informative`, `affirmative`, `cautionary`, `negative`,
`pending`, and `unavailable` for owners such as surfaces, rails, and static rows. Those values are
render-neutral: they paint a fact that authority already established, and they never create one.

## STATE-1 — Name the meanings before choosing carriers

Governs the order in which state decisions are made.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A feature has more than one reachable condition | Every business fact and every transition between them is named first, before any prop is chosen |
| Case 2 | The named facts are ready to bind | Each takes its own carrier: `isDisabled`, `isPending`, or `isSkeleton` where the owner publishes them, `Tabs.selectedKey`, `SurfaceAccordionCard.isOpen`, or a `PresentationState` on its owner |
| Case 3 | A single generic flag would cover several of them | It does not. One flag standing for disabled, pending, and unresolved collapses three facts into one |
| Case 4 | A transient cue is available and looks convenient | Hover or focus is never used as selected or expanded truth |
| Case 5 | A presentation value is available before authority has spoken | It waits. An affirmative row before a confirmed success is a claim nobody made |

## STATE-2 — Accepted work and unresolved content have separate owners

Governs the boundary between progress and loading.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A command accepted work | `isPending` on the initiating command, or the published forwarding prop such as `EmptyNotice.isActionPending` |
| Case 2 | Content has not resolved for the first time | `isSkeleton` on the content owner, which renders inert geometry and no announced value |
| Case 3 | A measurement is unknown | It stays unresolved. A rendered zero is a measurement and states something false |
| Case 4 | A peer control did not start the work | It carries no progress cue of its own |

Not this rule: what the reader is told once the work settles is FEEDBACK-3.

## STATE-3 — Absence is complete

Governs what a branch leaves behind when it does not exist.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Authority says an optional branch, control, region, or slot does not exist now | It is not mounted, through the published optional contract, such as omitting the `ChatWorkspace` rail or omitting `EmptyNotice.actionLabel` |
| Case 2 | Hiding it visually would be easier | Visual hiding is not absence, and an invisible control that still responds is worse than a visible one |
| Case 3 | The branch sat inside a grid or a flex row | Its wrapper, track, spacer, divider, and reserved scroll range go with it |
| Case 4 | The branch contained anything focusable | Nothing focusable and nothing in the accessibility tree survives it |

## STATE-4 — Coverage the direction commits to

Governs the matrix the audit will be asked to execute.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A feature has several states and several widths | The state, transition, viewport, and input or content condition matrix is named up front |
| Case 2 | A pending path exists | Every pending path has a reachable settlement, including cancellation |
| Case 3 | Two facts appear to share a carrier | The overlap is resolved before delivery, not discovered during audit |
| Case 4 | A family or the application adds a delta | Each layer is isolated, so a lost selected state can be attributed to the layer that lost it |

## STATE-5 — Whole-surface action or static surface

Governs whether a surface is itself one interactive thing.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The entire surface leads to one destination | `SurfaceCard.wholeAction` as `{ kind: "link", href, label }`, giving one semantic target with one accessible name |
| Case 2 | The entire surface runs one command | `SurfaceCard.wholeAction` as `{ kind: "button", press, label }` |
| Case 3 | The surface is not interactive | `wholeAction` is omitted, and no click handler or hover response is added to make it feel interactive |
| Case 4 | The surface needs a smaller independent action inside it, such as a row menu | The boundaries are split so the whole-surface target and the smaller action do not overlap |

Not this rule: how many effects one activation may reach is ACTION-1.

## STATE-6 — Persistent peer choice

Governs a selected value shared by peer views.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Peer views share one selection that must outlive hover, press, and focus | `Tabs` with an application-owned `selectedKey`, ordered `items`, and `onSelect` |
| Case 2 | Each peer controls a panel | `panelId` associates the tab with its panel, so the relationship is published rather than implied |
| Case 3 | The direction is tempted to keep a second selected value locally | It does not. One controlled value drives the rendering, or two owners will disagree |
| Case 4 | The direction is tempted to wrap the published tabs in its own tab roles | It does not. Duplicate composite semantics create a second owner of the same choice |

## STATE-7 — Controlled disclosure

Governs a summary that reveals a region.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | One summary reveals or hides one associated region | `SurfaceAccordionCard` with `isOpen`, `summaryRender`, `bodyRender`, and `onOpenChange` |
| Case 2 | A list has several independently controlled disclosures | Controlled `items` with `onItemOpenChange`, so each open value belongs to its own item |
| Case 3 | Hover would open it, or a second trigger would sit beside the published one | Neither. Disclosure is driven only through the controlled value, from one trigger |
| Case 4 | The closed body contains links or controls | Closed means nothing inside it is focusable or announced |

## What this file does not decide

Which regions exist to hold these states is [Layout](layout.md), and which branch survives a reflow
is [Responsive](responsive.md). Which control carries a decision, and who owns pending among several
controls, is [CTA](cta.md) and [Action](action.md). What the reader is told at each outcome is
[Feedback](feedback.md). Whether the rendered state is announced, reachable, and truthful is
[Accessibility](../proof/accessibility.md), [Focus](../proof/focus.md), and
[Render truth](../proof/render-truth.md).

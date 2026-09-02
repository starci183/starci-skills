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

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A feature has more than one reachable condition | Every business fact and every transition between them is named in the receipt before any carrier prop appears against it |
| Case 2 | The named facts are ready to bind | Each named fact resolves to its own carrier: `isDisabled`, `isPending`, or `isSkeleton` where the owner publishes them, `Tabs.selectedKey`, `SurfaceAccordionCard.isOpen`, or a `PresentationState` on its owner |
| Case 3 | A single generic flag would cover several of them | No carrier appears against more than one named fact, so disabled, pending, and unresolved never share one flag |
| Case 4 | A transient cue is available and looks convenient | No hover or focus cue carries a selected or expanded value |
| Case 5 | A presentation value is available before authority has spoken | Every `PresentationState` value in the tree traces to a fact authority already settled; none precedes it |

## STATE-2 — Accepted work and unresolved content have separate owners

Governs the boundary between progress and loading.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A command accepted work | `isPending` sits on the initiating command, or on the published forwarding prop such as `EmptyNotice.isActionPending` |
| Case 2 | Content has not resolved for the first time | `isSkeleton` sits on the content owner, and that owner renders inert geometry with no announced value |
| Case 3 | A measurement is unknown | No node states a value for it; a rendered zero appears nowhere in place of an unknown measurement |
| Case 4 | A peer control did not start the work | That control carries no progress cue of its own |

Not this rule: what the reader is told once the work settles is FEEDBACK-3.

## STATE-3 — Absence is complete

Governs what a branch leaves behind when it does not exist.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Authority says an optional branch, control, region, or slot does not exist now | The branch is unmounted through the published optional contract, such as an omitted `ChatWorkspace` rail or an omitted `EmptyNotice.actionLabel` |
| Case 2 | Hiding it visually would be easier | No node for that branch remains in the tree, visible or not, and nothing invisible still responds to input |
| Case 3 | The branch sat inside a grid or a flex row | Its wrapper, track, spacer, divider, and reserved scroll range are absent with it |
| Case 4 | The branch contained anything focusable | Nothing from that branch is focusable and nothing from it appears in the accessibility tree |

Retired: STATE-4 is retired into COVERAGE-1 and is not reused; the address stays spent.

## STATE-5 — Whole-surface action or static surface

Governs whether a surface is itself one interactive thing.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The entire surface leads to one destination | `SurfaceCard.wholeAction` is `{ kind: "link", href, label }`, giving exactly one semantic target with one accessible name |
| Case 2 | The entire surface runs one command | `SurfaceCard.wholeAction` is `{ kind: "button", press, label }` |
| Case 3 | The surface is not interactive | `wholeAction` is absent, and the surface carries no click handler and no hover response that implies interaction |
| Case 4 | The surface needs a smaller independent action inside it, such as a row menu | The whole-surface target and the smaller action occupy disjoint boundaries; neither encloses the other |

Not this rule: how many effects one activation may reach is ACTION-1.

## STATE-6 — Persistent peer choice

Governs a selected value shared by peer views.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Peer views share one selection that must outlive hover, press, and focus | `Tabs` carries an application-owned `selectedKey` with ordered `items` and `onSelect` |
| Case 2 | Each peer controls a panel | `panelId` associates each tab with its panel, so the relationship is published rather than implied |
| Case 3 | The direction is tempted to keep a second selected value locally | Exactly one controlled value drives the rendering; no local copy of that selection exists |
| Case 4 | The direction is tempted to wrap the published tabs in its own tab roles | No node outside `Tabs` carries composite tab semantics for the same choice |

## STATE-7 — Controlled disclosure

Governs a summary that reveals a region.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | One summary reveals or hides one associated region | `SurfaceAccordionCard` carries `isOpen`, `summaryRender`, `bodyRender`, and `onOpenChange` |
| Case 2 | A list has several independently controlled disclosures | Controlled `items` with `onItemOpenChange` bind each open value to its own item |
| Case 3 | Hover would open it, or a second trigger would sit beside the published one | Disclosure changes only through the controlled value, from exactly one trigger; no hover path and no second trigger reaches it |
| Case 4 | The closed body contains links or controls | While closed, nothing inside the body is focusable or announced |

## What this file does not decide

Which regions exist to hold these states is [Layout](layout.md), and which branch survives a reflow
is [Responsive](responsive.md). Which control carries a decision, and who owns pending among several
controls, is [CTA](cta.md) and [Action](action.md). What the reader is told at each outcome is
[Feedback](feedback.md). What the receipt must enumerate about these states is
[Coverage](coverage.md). Whether the rendered state is announced, reachable, and truthful is
[Accessibility](../proof/accessibility.md), [Focus](../proof/focus.md), and
[Render truth](../proof/render-truth.md).

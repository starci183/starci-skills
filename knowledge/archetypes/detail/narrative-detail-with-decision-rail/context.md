# Narrative detail with decision rail

## LOADS

None.

## Identity

### Archetype record

`narrative-detail-with-decision-rail` is a reusable detail-screen archetype for one subject whose
meaning is explained through substantial narrative content and whose next consequential decision
depends on a compact set of facts. It keeps the explanation primary and gives the decision a clearly
bounded supporting region. The supporting region is a **decision rail** because it helps a person
decide and commit; being positioned beside the content is not enough to make a region this rail.

Search aliases include `narrative detail`, `detail with CTA`, `detail with purchase rail`, `detail with
enrolment rail`, `detail with application rail`, `content with decision summary`, and `long-form detail
with action`.

### Dominant task

Understand one subject well enough to make one primary consequential decision without losing the
decisive facts, qualifications, warnings, or recovery path needed for that decision.

### Promise

- The narrative remains a readable, coherent account rather than a collection of promotional tiles.
- The decision region stays visibly subordinate to the subject while remaining easy to find.
- Decisive facts and the primary action describe the same subject and the same current state as the
  narrative.
- A narrower or magnified view preserves the decision, the evidence needed to judge it, and all
  qualifications; it does not preserve the desktop silhouette at their expense.
- Layout does not invent product facts, eligibility rules, prices, statuses, or action consequences.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ND-01` | One subject needs substantial explanation before one primary commitment | required positive signal |
| `AR-ND-02` | A compact set of decisive facts, qualifications, or warnings must remain associated with that commitment | required positive signal; give those facts a decision rail on sufficiently wide views |
| `AR-ND-03` | The narrative and rail can no longer remain adjacent without harming reading, interaction, or fact integrity | transform the rail into the stable in-flow decision region |
| `AR-ND-04` | A persistent compact action materially helps continuation and can remain clear of content, focus, system UI, and safe areas | a sticky bottom decision action is permitted |
| `AR-ND-90` | The supporting region mainly lists headings, shows reading position, or moves between sections | reject; it is an outline or navigation rail |
| `AR-ND-91` | The dominant task is peer comparison, catalogue discovery, data manipulation, or completion of a long form | reject; route to the archetype that owns that task |

### Choose it when

- There is exactly one detail subject at the page level.
- The main content contains multiple meaningful sections that a person may need before committing.
- One primary commitment dominates, such as acquire, enrol, apply, reserve, accept, start, or renew;
  the exact verb and consequence come from product authority.
- A small decision summary can state the facts that govern that commitment without reproducing the
  full narrative.
- On a wide view, keeping that summary adjacent to the narrative reduces memory burden or needless
  movement between the evidence and the action.
- The subject remains useful to read even when the decision is unavailable or already completed.

### Refuse it when

- The side region would be present only to make the page look balanced.
- The action is unrelated promotion, cross-sell, advertising, or navigation to another subject.
- Several peer items or several competing primary actions need simultaneous comparison.
- The supposed narrative is only a short message and one control; a focused single-task archetype is
  the smaller truthful shape.
- The work requires continuous editing, inspection, or data manipulation; a workbench or editor owns
  that topology.
- The rail's main purpose is section navigation. `AR-ND-90` applies even if that rail also
  contains a minor action.

## Region graph

### Canonical regions

```text
detail-surface
├─ detail-header
│  ├─ subject-identity
│  ├─ concise-summary
│  └─ optional-section-navigation
└─ detail-body
   ├─ narrative-main
   │  ├─ overview
   │  ├─ evidence-or-capabilities
   │  ├─ requirements-or-conditions
   │  └─ supporting-content
   └─ decision-region
      ├─ decisive-facts
      ├─ qualification-or-warning
      ├─ primary-decision-action
      └─ policy-or-recovery
```

`optional-section-navigation` belongs to the narrative, not to the decision region. It may be absent.
The four named narrative sections express roles, not a mandatory content taxonomy; the routed grammar
may rename, omit, or extend them while preserving one coherent primary narrative.

### Region relationships

1. `subject-identity` establishes the single object shared by every downstream region.
2. `concise-summary` orients; it does not become a second long-form introduction.
3. `narrative-main` owns the evidence and explanation. Its sections have an authored order and remain
   intelligible without the visual rail beside them.
4. `decisive-facts` is a concise projection of current decision inputs. It may summarize but must not
   contradict or silently fork facts from the narrative or product state.
5. `qualification-or-warning` appears before commitment whenever it can materially change consent,
   cost, eligibility, availability, risk, or outcome.
6. `primary-decision-action` commits or begins the one dominant consequence. Secondary links cannot
   compete with it visually or semantically.
7. `policy-or-recovery` explains a governing condition or provides a path from an unavailable or
   failed decision; it is not a miscellaneous link list.
8. The decision region is one logical region across all responsive forms. A side rail, an in-flow
   section, and an allowed sticky action are presentations of that same decision, not separate sources
   of truth.

## Responsive contract

### Wide

- Present `narrative-main` and `decision-region` as adjacent primary and supporting regions only while
  the narrative retains a comfortable reading measure and every decision value and control remains
  legible and operable.
- Let the detail header establish one subject above both regions. Section navigation, when present,
  remains associated with the narrative rather than being visually absorbed into the decision rail.
- The decision rail may remain within view while the page scrolls when its complete required content
  fits without clipping. If it grows beyond the available view, it participates in page flow instead
  of acquiring a competing same-axis scroll area.
- Narrative and decision failures resolve independently: a delayed decision fact does not replace the
  readable narrative with a whole-page wait state, and a delayed narrative section does not erase an
  already known decision status.

### Intermediate

- Preserve the two-region arrangement only while both regions still satisfy their content needs; do
  not squeeze prose, wrap decisive values into ambiguity, truncate labels, or reduce controls merely
  to delay a topology change.
- Remove or relocate tertiary decoration and optional supporting material before moving required
  facts, qualifications, warnings, or recovery controls.
- When adjacency stops working, apply `AR-ND-03`: place the decision region at its stable
  logical position in the page flow. This may occur before a conventional device category because the
  transformation is content-driven.
- An outline or section navigator may independently become a disclosure or jump control. That change
  never turns it into the decision region and never removes the path to the page's authored sections.

### Compact

- Use one readable page column. Preserve the subject identity, authored narrative order, decisive
  facts, material qualification or warning, primary decision, and recovery path.
- The default transformation is an in-flow `decision-region` at its stable logical position.
- `AR-ND-04` permits the primary decision action to become a sticky bottom action only when
  the associated status is unambiguous and the presentation reserves or releases enough space that
  page content, focused controls, validation, browser or operating-system UI, and safe areas remain
  unobscured.
- If the decision requires facts or consent that cannot fit meaningfully in the persistent action,
  keep those facts in flow and ensure the action cannot bypass them. Do not compress a warning into an
  unlabeled icon or a hidden state.
- Do not retain a narrow side rail, introduce horizontal page scrolling, or place the long narrative
  inside a modal merely to preserve wide-view adjacency.

### Reflow and parity

At narrow widths, magnification, increased text spacing, long localization, and content growth, the
page must remain understandable as a vertical reading experience. Required prose and decisive values
wrap or grow; they are not clipped to preserve surface height. The transformation is driven by whether
the content still works, not by a fixed device name or a fixed breakpoint recorded in this archetype.

#### Reading order

Use one meaningful logical order across widths: subject identity, concise summary, narrative sections
in authored order, decisive facts, material qualification or warning, primary decision, then policy or
recovery. If product evidence requires the decision region earlier, place it earlier in that logical
order at **all** widths; do not use visual column reordering to make keyboard or assistive reading order
change at a breakpoint. Headings or landmarks must make both the narrative and the decision directly
navigable when the page is long.

#### Navigation replacement

When an optional outline or section navigator cannot remain adjacent, replace it with an operable
in-flow jump list, disclosure, or equivalent route to the same sections. The decision rail itself is
not replaced by navigation: it becomes the in-flow decision region, with the separately permitted
sticky action as a presentation of its primary action only.

#### Sticky behavior

Persistence is optional, never the identity of the archetype. A sticky rail becomes static when its
content cannot fit, when zoom or text growth reduces the usable view, or when it would obscure content
or focus. A sticky bottom action must account for its occupied area, remain dismissible or become
static when necessary, and never cover the target of keyboard, switch, voice, validation, or anchor
navigation. Do not keep a second competing primary action solely because one presentation is sticky.

#### Overflow owner

The page is the default vertical overflow owner. The narrative and decision region do not create
nested same-axis scrolling merely to stay side by side or inside a card. A bounded disclosure may own
temporary overflow only when its interaction model and focus return are explicit; it cannot contain
the essential long-form narrative by default. Exceptional two-dimensional media keeps its own
appropriate handling without making the whole page horizontally scroll.

#### Interaction parity

Wide, intermediate, compact, zoomed, keyboard, and assistive presentations expose the same decision
consequence, current status, decisive facts, material qualifications or warnings, policy or recovery
path, pending feedback, and success or failure outcome. Presentation may change; capability and
meaning may not. Focus returns to a predictable place after disclosures and moves to actionable error
or success feedback only when that helps continuation.

## State obligations

### Content and fact states

- `content-loading`: preserve the known page anatomy and identify which narrative region is waiting.
- `content-partial`: keep available sections readable and identify missing or delayed evidence without
  presenting the page as complete.
- `content-ready`: show one internally consistent subject version.
- `content-empty`: explain why the expected subject content is absent and provide an evidenced next
  step when one exists.
- `content-failed`: preserve subject context and offer retry, return, or support according to product
  authority.
- `content-stale`: identify that decisive facts may no longer match the latest state before commitment.
- `decision-facts-loading`, `decision-facts-ready`, `decision-facts-failed`, and
  `decision-facts-stale`: resolve independently from narrative availability; unknown required facts
  never masquerade as zero, free, available, or eligible.

### Decision states

- `decision-available`: the consequence and current decisive facts are known, and the action can be
  named precisely.
- `decision-unavailable`: state the reason and expose only valid recovery or alternative paths.
- `decision-requires-prerequisite`: identify the unmet condition before the action and preserve the
  return path after satisfying it.
- `decision-already-completed`: replace an obsolete commit action with the truthful continuation or
  status; do not invite the same consequence again.
- `decision-pending`: prevent accidental duplicate commitment, retain the action label's meaning, and
  show progress in the decision region.
- `decision-succeeded`: confirm the outcome and provide the next meaningful destination or stable
  completed state.
- `decision-failed`: keep entered or selected context where safe, explain what happened at the action,
  and expose a valid retry or recovery path.
- `decision-changed`: when a material fact changes before commitment, require the person to encounter
  and acknowledge the current fact rather than silently submitting the earlier understanding.

### Failure and recovery

- A decision-region failure does not erase readable narrative content.
- A narrative-section failure does not falsely mark the decision as unavailable unless product rules
  genuinely make the missing evidence a prerequisite.
- Action feedback and errors appear with the logical action, including when its compact presentation
  is sticky; state cannot diverge between responsive presentations.
- Required qualification and warning states use more than color and remain available to assistive
  technology.
- Recovery preserves orientation to the same subject. A retry must not unexpectedly restart the whole
  page or duplicate a completed commitment.

## Boundaries

### Decision rail versus outline or navigation rail

A decision rail answers: **What facts govern my decision, what happens if I act, and can I act now?**
An outline or navigation rail answers: **Where am I in this content, and which section can I open?**

The distinction is semantic, not geometric:

- A region full of section links, chapter progress, or current-heading state is navigation even when
  it sits on the right.
- A region containing decisive facts, a material warning, one primary commitment, and its recovery is
  a decision region even after it moves into page flow.
- If both are needed, keep them as two named responsibilities with independent responsive
  transformations. Do not make one ambiguous rail own both long-page navigation and commitment.
- If navigation dominates, `AR-ND-90` rejects this archetype in favor of a reader-with-outline
  or equivalent navigation-led detail archetype.

### Adjacent archetypes

| Dominant need | Boundary verdict |
|---|---|
| Browse or filter many peer subjects | use a searchable catalogue or collection archetype |
| Compare decisive attributes across several peers | use a comparison archetype |
| Select an item from a list while inspecting its detail | use a list-detail archetype |
| Read long content while navigating an outline, with no primary commitment | use a reader-with-outline archetype |
| Complete one short action with little supporting content | use a centered single-task archetype |
| Enter a long or staged body of information | use a form or workflow archetype |
| Manipulate data continuously while inspecting supporting information | use a workbench or analytical workspace archetype |
| Read one subject and make one evidenced primary commitment | use `narrative-detail-with-decision-rail` |

Do not create the rail when the same truthful result is clearer as a short in-flow decision section.
The archetype names a relationship that earns a wide-view rail, not a requirement that every detail
page grow a second column.

### Boundary verdict

Return `accept` only when both `AR-ND-01` and `AR-ND-02` are evidenced and neither rejection code is
present. Return `reject` when `AR-ND-90` or `AR-ND-91` is evidenced or another archetype clearly owns
the dominant task. Return `needs-evidence` when the single subject, primary consequence, decisive facts,
rail purpose, logical reading position, or responsive transformation is unresolved and would materially
change the topology or state contract.

## Handoff

### Grammar

The selected product grammar supplies the real subject identity; narrative section meanings; decisive
facts; eligibility, availability, ownership, and prerequisite semantics; action verb and consequence;
warning and policy obligations; state transitions; and the semantic owners allowed to render them.
Grammar also decides whether an early or late logical decision position is evidenced for the product.
This archetype must not infer those facts from familiar commerce, learning, media, or application
examples.

### Principles

Principles resolve the accepted situation into exact reading measure, region proportions, alignment,
spacing, surface treatment, typography, responsive thresholds, sticky offsets, safe-area handling,
focus accommodation, and motion. They may choose implementation values only after content pressure and
the routed system are known. No class name, token, component, fixed width, or fixed breakpoint belongs
in this archetype.

### What this archetype owns

This archetype owns the dominant task, canonical region roles, relationships between narrative and
decision, wide-to-in-flow transformation, reading and overflow invariants, sticky permission boundary,
interaction parity, required state families, and rejection boundary. It returns a topology and its
obligations. It does not return visual direction, product behavior, source files, imports, or compiled
layout values.

## Non-binding research evidence

### Evidence boundary

The sources below are advisory comparison evidence. They strengthen or challenge the reusable shape;
they do not define product facts, choose a grammar owner, select a component, or override this Source's
authority. Source terminology is not copied into the runtime contract unless the archetype independently
states the same product-neutral relationship.

### Sources

| Source | Relevant observation | Influence on this archetype |
|---|---|---|
| [Material Design 3 — Canonical layout examples](https://m3.material.io/foundations/layout/canonical-examples/overview) | A supporting-pane layout separates a majority primary area from a secondary supporting area and provides configurations across compact, medium, and expanded conditions. | Supports the primary/supporting region relationship and the requirement to transform across available space; it does not establish that a supporting pane is a decision rail. |
| [Apple Human Interface Guidelines — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Adjacent panes need horizontal room; compact environments should avoid illegible or hard-to-operate splits, and hidden panes need logical ways to return. | Supports content-driven collapse and preservation of access when an adjacent region is no longer viable. |
| [W3C WAI — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Narrow or magnified content generally reflows vertically; sticky side content should become static or user-toggleable when it obstructs reading. | Supports one-column reflow, page-owned overflow, and releasing persistence under content pressure. |
| [W3C WAI — Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Author-created sticky content must not entirely hide the component receiving keyboard focus. | Establishes the minimum boundary for any sticky rail or compact bottom action; this archetype prefers the stronger outcome of no obscured focus or essential content. |
| [Carbon Design System — 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/) | A side panel changes the space available to the primary grid and is useful when people must retain page context while completing a related task. | Supports testing the main content under the rail's actual pressure rather than treating the rail as an overlay with no consequence. |
| UI/UX Pro Max local `ux-guidelines.csv` searches for `responsive supporting pane reflow` and `focus not obscured sticky action` | Returned guidance prioritizes text reflow, avoidance of horizontal page scroll, and focus visibility around persistent UI. | Corroborates the reflow and sticky-focus obligations; it remains local advisory data, not product or repository law. |

## Output

Return one resolved archetype record using exactly these fields:

```json
{
  "archetypeId": "narrative-detail-with-decision-rail",
  "situationCodes": [],
  "searchAliases": [],
  "dominantTask": "",
  "regions": [],
  "regionRelationships": [],
  "responsive": {
    "wide": "",
    "intermediate": "",
    "compact": "",
    "reflow": "",
    "readingOrder": "",
    "navigationReplacement": "",
    "stickyBehavior": "",
    "overflowOwner": "",
    "interactionParity": ""
  },
  "stateObligations": [],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [],
  "principlesHandoff": [],
  "confidence": "low",
  "evidence": []
}
```

Do not return a class, token, component name, source path, fixed breakpoint, or invented product fact.
A verdict of `accept` is valid only when `AR-ND-01` and `AR-ND-02` apply and neither `AR-ND-90` nor
`AR-ND-91` is present. A sticky compact action is valid only when `AR-ND-04` carries
explicit unobscured-content and focus evidence.

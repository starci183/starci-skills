# Hierarchy composition

This file answers one question: given a piece of business meaning, which information rank does it
receive, and where does it sit relative to everything else in its region?

Hierarchy is decided from the job the content does, never from how prominent the direction wishes it
looked. Rank is carried by a published semantic owner, so the outline a screen reader walks and the
outline a reader sees are the same outline.

## HIERARCHY-1 — Rank comes from the job, not the look

Governs which semantic owner carries a piece of content.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | Content names a page or a section | `Heading` at the level the outline requires |
| Case 2 | Content explains, or states a neutral fact | `Text` in its default role |
| Case 3 | Content reports a compact outcome backed by authority | `Badge`, or another state owner that publishes that outcome |
| Case 4 | Content reports a verified numeric completion | `Progress` with a truthful label and value |
| Case 5 | Something feels important but matches no published role | The job is settled first. Wanting larger type or a brighter colour is not a rank, and a local type utility does not create one |

Not this rule: how much emphasis paint that rank receives is ACCENT-1.

## HIERARCHY-2 — One strongest anchor per region

Governs how many things may name the same region.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | A region carries a name plus supporting copy, facts, statuses, or actions | Exactly one strongest semantic anchor names the region's job, through `SectionHeader`, `Heading`, or a labelled surface |
| Case 2 | Two candidates both look like the region's name | Either the region splits into genuine peer regions, each with its own anchor, or one candidate is demoted |
| Case 3 | A status wants to be louder than the thing it describes | The status stays subordinate to the name it qualifies |
| Case 4 | Independent peer regions sit side by side | Each is settled on its own; one region's anchor does not rank against another's |

Not this rule: which region comes first on the page is LAYOUT-1.

## HIERARCHY-3 — Reading order equals task dependency

Governs the sequence in which meaning is delivered.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The reader needs context before making a choice | Prerequisite, decision, consequence, then support, in that DOM order |
| Case 2 | A layout would read better with the pieces rearranged at one width | The composition changes. CSS `order` never reverses meaning |
| Case 3 | Help text explains a field or a task | It follows the thing it explains, in DOM and in the accessibility tree |
| Case 4 | A result is produced by an action on the same surface | The action precedes the result it produces, at every width |

Not this rule: whether sequential keyboard focus actually follows this order once rendered is
FOCUS-2.

## HIERARCHY-4 — Facts, measurement, and outcome are separate ranks

Governs the boundary between what is merely true, what is measured, and what has been decided.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The content is a neutral fact with no claim attached | `Text`, with no status or success treatment |
| Case 2 | The content is a measurement between 0 and 100 backed by authority | `Progress`, whose label and value describe the same verified measurement |
| Case 3 | The measurement has not resolved yet | `Progress isSkeleton`. A real zero is a measurement and is not the same thing |
| Case 4 | The content is an outcome someone can act on | An explicit outcome word plus its state owner, never a colour standing in for the word |
| Case 5 | The direction is tempted to let one rank imply another | It does not. A filled bar is not a completion, and an ordinary fact does not become urgent because it is painted as a warning |

## HIERARCHY-5 — Rank survives reflow, loading, and lost colour

Governs the conditions under which the chosen hierarchy must still hold.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The region stacks at a narrow width | Heading order and the count of strongest anchors are unchanged; only placement moves |
| Case 2 | Content is still loading | The skeleton keeps the same selected role, so the rank does not jump when real content arrives |
| Case 3 | Optional content is missing in some states | It was never the only carrier of a rank |
| Case 4 | Colour is removed, or the viewer is in forced colours | Every rank distinction still has a semantic or structural cue |

Not this rule: capturing the zoomed, forced-colour, and colour-removed renders is the audit
operator's work.

## What this file does not decide

Which regions exist and who owns their tracks is [Layout](layout.md). How rank behaves as space
changes is [Responsive](responsive.md). Which action is dominant is [CTA](cta.md), and how scarce
emphasis is spent is [Accent](accent.md). The rendered accessibility tree that proves this outline
is [Accessibility](../proof/accessibility.md), and agreement between rank and product truth is
[Render truth](../proof/render-truth.md).

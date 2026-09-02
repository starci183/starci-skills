# Hierarchy composition

This file answers one question: given a piece of business meaning, which information rank does it
receive, and where does it sit relative to everything else in its region?

Hierarchy is decided from the job the content does, never from how prominent the direction wishes it
looked. Rank is carried by a published semantic owner, so the outline a screen reader walks and the
outline a reader sees are the same outline.

## HIERARCHY-1 — Rank comes from the job, not the look

Governs which semantic owner carries a piece of content.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | Content names a page or a section | `Heading` carries it, at the level the outline requires |
| Case 2 | Content explains, or states a neutral fact | `Text` in its default role carries it, with no state owner attached |
| Case 3 | Content reports a compact outcome backed by authority | `Badge`, or another published state owner for that outcome, carries it |
| Case 4 | Content reports a verified numeric completion | `Progress` carries it, with a label and value that describe the same verified measurement |
| Case 5 | Something feels important but matches no published role | The receipt names the job before any owner is bound, and no local type utility stands in for a rank |

Not this rule: how much emphasis paint that rank receives is ACCENT-1.

## HIERARCHY-2 — One strongest anchor per region

Governs how many things may name the same region.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | A region carries a name plus supporting copy, facts, statuses, or actions | Exactly one strongest semantic anchor names the region's job, through `SectionHeader`, `Heading`, or a labelled surface |
| Case 2 | Two candidates both look like the region's name | Either the receipt lists two peer regions each with its own anchor, or one candidate carries a weaker rank |
| Case 3 | A status wants to be louder than the thing it describes | The status ranks below the name it qualifies |
| Case 4 | Independent peer regions sit side by side | Each region's anchor is settled within that region; no anchor ranks against another region's anchor |

Not this rule: which region comes first on the page is LAYOUT-1.

## HIERARCHY-3 — Reading order equals task dependency

Governs the sequence in which meaning is delivered.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The reader needs context before making a choice | DOM order runs prerequisite, decision, consequence, then support |
| Case 2 | A layout would read better with the pieces rearranged at one width | The composition differs at that width and the meaning order does not; no CSS `order` reverses meaning |
| Case 3 | Help text explains a field or a task | It follows the thing it explains in DOM order and in the accessibility tree |
| Case 4 | A result is produced by an action on the same surface | The action precedes the result it produces, at every width |

Not this rule: whether sequential keyboard focus actually follows this order once rendered is
FOCUS-2.

## HIERARCHY-4 — Facts, measurement, and outcome are separate ranks

Governs the boundary between what is merely true, what is measured, and what has been decided.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The content is a neutral fact with no claim attached | `Text` carries it, with no status and no success treatment |
| Case 2 | The content is a measurement between 0 and 100 backed by authority | `Progress` carries it, and its label and value describe the same verified measurement |
| Case 3 | The measurement has not resolved yet | `Progress isSkeleton` carries it, and no zero value is rendered in its place |
| Case 4 | The content is an outcome someone can act on | An explicit outcome word plus its state owner carries it; no colour alone states the outcome |
| Case 5 | The direction is tempted to let one rank imply another | No filled bar stands for a completion, and no ordinary fact takes a warning treatment |

## HIERARCHY-5 — Rank survives reflow, loading, and lost colour

Governs the conditions under which the chosen hierarchy must still hold.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The region stacks at a narrow width | Heading order and the count of strongest anchors are identical to the wide branch; only placement differs |
| Case 2 | Content is still loading | The skeleton carries the same selected role as the resolved content, so no rank changes when real content arrives |
| Case 3 | Optional content is missing in some states | Every rank present in one state has a carrier that survives the states where the optional content is absent |
| Case 4 | Colour is removed, or the viewer is in forced colours | Every rank distinction still resolves to a semantic or structural cue |

Not this rule: capturing the zoomed, forced-colour, and colour-removed renders is the audit
operator's work.

## What this file does not decide

Which regions exist and who owns their tracks is [Layout](layout.md). How rank behaves as space
changes is [Responsive](responsive.md). Which action is dominant is [CTA](cta.md), and how scarce
emphasis is spent is [Accent](accent.md). The rendered accessibility tree that proves this outline
is [Accessibility](../proof/accessibility.md), and agreement between rank and product truth is
[Render truth](../proof/render-truth.md).

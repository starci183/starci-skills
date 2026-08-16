---
name: starci-fe-layer-plan
description: Derive a StarCi page composition from a business requirement — which archetype, and what each region holds — by running the seven questions in fe/layers/INDEX.md against the requirement in order. Use before any page, layout or overlay is drawn, and before any seam or element decision is made. Writes no production code and stops at the first question the requirement cannot answer.
---

# StarCi FE Layer Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first, then
[`../../fe/layers/INDEX.md`](../../fe/layers/INDEX.md).

A layout is not chosen. It is derived, and the derivation is short enough that skipping it always
looks cheaper than running it. That is the trap this phase exists to close: a composition picked by
resemblance carries no reason, so the first person who wants to move something has nothing to argue
against and moves it.

The derivation runs on the requirement, not on a reference screen. Asking "what does this look like"
reaches for a picture; asking "what stays constant while the rest changes" reaches for a fact. Only
the second one survives a change of content.

This phase settles composition and stops there. Which element renders a field, and how far apart two
nodes sit, are different questions owned by different shelves. A brief here that starts naming gap
values or chip variants has left its lane and must hand those rows back.

## CONTEXT

Print the `### CONTEXT` table from `skill-shape.md` with `Phase: plan`, `Language: vi`, workflow kind
`designs`, and `Touching` limited to the workflow record. No production path belongs in `Touching`
for this phase.

`Purpose` states the surface being derived and the requirement in one sentence, in the user's own
words where they gave them.

## PROCESS

Read the requirement first, and read it as a statement about people rather than about screens. Then
run [`LAYER-2` through `LAYER-7`](../../fe/layers/INDEX.md) in that order, recording the answer and
the evidence for each. The order is load-bearing: `LAYER-7` asks whether an archetype already solves
this shape, and asked early it becomes imitation. Asked last it is a check against an answer already
derived, so agreement confirms and disagreement is a finding worth writing down.

Stop at the first question the requirement cannot answer. That silence is the output — it means the
product decision has not been made, and guessing it here buries a choice inside a layout where
nobody will find it later. Batch every such gap into `NEED APPROVALS` with the evidence that shows
why the requirement is short, and do not proceed past it.

When the questions resolve, route to an archetype through the table in the shelf INDEX, then open
that archetype's module and copy its `Region Contract` into the brief with this surface's actual
content filled into each region. A region that comes out empty is a finding: either the requirement
has less in it than assumed, or the archetype is wrong.

Check the archetype's `Breaks At` against the real numbers this surface will carry. A page arriving
already at the ceiling is not a page that fits; it is a page with no room, and saying so now is
cheaper than saying it after the fifth mode is requested.

Where the derivation lands on an archetype the shelf does not yet hold, say so plainly and describe
the shape with the same section headings a module uses. Raise it in `NEED APPROVALS` as a proposed
archetype, carrying the anchor that would admit it. This phase proposes; it does not write to
`fe/layers/`, because an archetype earns its module from a shipped screen rather than from the first
requirement that wanted it.

## OUTPUT

Print the six tables from `skill-shape.md`.

`OUTPUTS` carries the derivation: one row per `LAYER-N` question with its answer, then the archetype,
then the region assignment. `CHANGES` names only the workflow record.

`NEED APPROVALS` carries every question the requirement could not answer, and the archetype choice
itself whenever two archetypes both survived the derivation.

`WARNINGS` carries any region arriving at its `Breaks At` ceiling, and any answer inferred from a
sibling screen rather than stated in the requirement.

`OWED` carries the element and seam decisions this phase deliberately did not make, cleared by the
shelves that own them.

Invite [`starci-fe-layer-review`](../starci-fe-layer-review/SKILL.md) when every question is either
answered with evidence or raised as an approval.

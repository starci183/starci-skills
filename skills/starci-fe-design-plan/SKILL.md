---
name: starci-fe-design-plan
description: Draw two to four real screens for net-new or undecided StarCi frontend work and stop for the user to pick one. Use when hierarchy, CTA, interaction or disclosure still needs a product choice. Renders real HTML from port 8080 and writes no production code. Not for a bounded fix with a known reference — that is starci-fe-fidelity-fix.
---

# StarCi FE Design Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first: SCOPE, PROCESS, OUTPUT, and the task file
at `<backend-repo>/.workflows/<app>/<id>.md`.

Plan exists for one reason — a choice the user has to make. If the answer is already proven by a
named reference, a contract or a test, this is `$starci-fe-fidelity-fix` and there is nothing to
choose.

## SCOPE

Print the table. `Touching` is the artifact directory and nothing else — Plan writes no production
source. Name the app and database when the screens depend on backend behavior.

## PROCESS

**Read the evidence before drawing.** The live GraphQL schema decides what the product can actually
say; a screen promising a field nobody serves is a screen that cannot ship. The existing components
under `src/components` decide what can be built cheaply. A named legacy screen, when the request
names one, decides parity. Read
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) for the tiers you will draw with, and
[`../../fe/design/hierarchy.md`](../../fe/design/hierarchy.md) and
[`call-to-action`](../../fe/design/call-to-action.md) for what earns attention.

**Draw two to four screens that differ in PRODUCT decisions** — reading order, CTA priority, what is
disclosed and what is folded away, density, composition. Not colour, not spacing. A migration or
parity request always includes a parity-first option. Real HTML, hosted from the first free port:

```powershell
python <trust-root>/skills/starci-fe-design-preview/scripts/serve_preview.py <directory> --start-port 8080
```

Every canvas says `DIRECTIONAL - NOT AN IMPLEMENTATION BASELINE`. Plan HTML is how a choice is made
visible; Preview rebuilds the winner from real components and never copies this.

**Inventory before invention.** Before a screen proposes a new contract entry, composite or row, list
the existing keys whose shape already expresses the same relationship and say REUSE, EXTEND, or NEW
because <the relationship nothing existing can express>. An entry repeating another entry's class
list and child identities is the same concept under a second name, and
`starci-fe/no-duplicate-entry-shape` refuses it. A screen whose anatomy no existing component can
express, and that proposes no exact new owner, is not a real option.

## OUTPUT

**The first table carries the HTML, and the run is not finished without it.** Every direction — two
to four of them — is a real page at a real URL, and that link is the first row of `Đã làm`. A Plan
whose output describes three directions in prose has produced nothing: the whole point of this phase
is a choice made by LOOKING, and a reader cannot look at a paragraph. One row per direction, with
its own address, plus the screenshot when the pane will not open.

The confirm table then carries exactly one question — which direction — with the directions as its
options. A fact the screens need and the schema does not serve, an asset that does not exist, or a
backend capability that has to be designed first is a second row, not a reason to skip the first.

Once the user has picked: append `## plan` to the task file with the SCOPE table, the chosen
direction and their reason, and every UX call you took on your own. Then invite
`$starci-fe-design-preview` — it builds the chosen screen from real components and contracts, renders
every owner state, and asks you to approve it.

Do not pick for the user. If the answer stays ambiguous after one more direct question, take the
parity-first option where a baseline exists and the most conservative one otherwise, and say plainly
that it was a default rather than a choice.

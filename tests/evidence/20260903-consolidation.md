# Consolidation, 2026-09-03

The round after the presentation sweep, the taste lens, the UX lens and the scorecard had all landed
in one day. Each of them was defensible on its own; together they had put several concepts in more
than one place, and one of them — the scorecard — was an entire file of pointers. This note records
what was measured, what was folded, and what each retired address now resolves to.

The measure is **places per concept**: how many files state a concept, counting a citation as zero.
Line count is not measured, because trimming by length eats the reasoning before it eats the
duplication.

## Concept to places, before and after

| Concept | Places before | Places after | What happened |
| --- | --- | --- | --- |
| Shell geometry (a band drawn instead of composed) | 4 — `FE-IMPORTS-7` Case 7, `FE-IMPORTS-7` Case 9, the sweep's header comment, the sweep's hard-coded name list | 1 — `FE-IMPORTS-7` Case 7 | Case 9 folded into Case 7; the comment became a citation; the gate now parses the shell-unit names out of Case 7 |
| Band placement (the hero slot) | 2 — `FE-IMPORTS-7` Case 9, the sweep comment | 1 — `FE-IMPORTS-7` Case 7 | same fold: where a band is mounted and whether it was drawn by hand are one law about one object |
| Paired specs, one per half | 3 — `FE-TEST-7`, `FE-TEST-1` Cases 1-2, `FE-TEST-2`/`FE-TEST-3` mock mechanics | 1 — `FE-TEST-1` Case 7 | `FE-TEST-7` retired; its two "does not stand in for" cases were restatements of the mock rules and are now citations |
| Twin roles (connected half, pure half) | 3 — `FE-FUNCTION-4`, `FE-TEST-7` intro, `FE-FOLDER-2` Case 4 | 1 — `FE-FUNCTION-4` | the test file and the folder file now cite it |
| Deployment constants | 1 with an embedded census — `FE-FOLDER-6` Case 5 | 1 shape, census moved here | the Case states the shape; the counts are evidence |
| Currency and locale literals | 1 with an embedded census — `folder.md` open question | 1 shape, census moved here | same treatment; the observation still points away from a shared module |
| Density band per surface class | 2 — `TASTE-9`, `UI-9` | 1 — `TASTE-9` | the class table went with the scorecard; the band lives with the measure |
| Accent count per surface class | 2 — `TASTE-5`, `UI-9` | 1 — `TASTE-5` | the two had drifted: one said "exactly one", the other allowed two on a landing page |
| Navigation depth per class | 2 — `UX-5`, `UI-9` | 1 — `UX-5` | |
| Steps budget per class | 2 — `UX-2`, `UI-9` | 1 — `UX-2` | |
| Minimum target size | 2 — `A11Y-4` Case 1, `TASTE-11` Case 1 | 1 — `A11Y-4` Case 1 | `TASTE-11` cites it |
| Which lenses exist, and what gates each | 9 — one `UI-n` per lens, each pointing at the topic that owned it | 0 as a rule; 1 as a receipt contract | every proof topic now closes itself; the meeting place is the `## Verdict` table, not a second id layer |
| The final answer (ship / fix-first / blocked) | 2 — `UI-10`, the audit operator's prose | 1 — the `quality.verify` receipt contract and its validator | the operator prose now cites rather than restates |
| Surface class vocabulary | 2 — `UI-9`'s five-case table, the UAT flow template | 1 — `COVERAGE-1` Case 7 | five names, no numbers |
| Taste arithmetic | 2 — `TASTE-13`, the audit operator's prose | 1 — `TASTE-13` | |
| Presentation sweep codes | 2 — the sweep's own comment block, the knowledge topics it reads | 1 — the topics | the comment cites |
| Responsiveness checked twice | 0 stated, 2 implied | 1 — `RESPONSIVE-4` Case 6 | the candidate is served per viewport before the tree exists; the audit measures every viewport after |

Totals for the concepts this round touched: **44 places before, 19 after**, with eleven rule ids and
one whole file retired and nothing renumbered.

## Retired addresses and where they now resolve

`UI-1` to `UI-11` were a scorecard file. Each address now resolves to the topic rule that owns the
decision it used to point at:

| Retired | Resolves to |
| --- | --- |
| `UI-1` canon presentation lens | the presentation topics, judged per owner and reported as the `presentation` row |
| `UI-2` composition lens | the composition topics, reported as the `composition` row |
| `UI-3` responsive lens | `RESPONSIVE-1` to `RESPONSIVE-4`, with `RESPONSIVE-4` Case 6 naming the two checks |
| `UI-4` motion lens | `MOTION-5` |
| `UI-5` accessibility lens | `A11Y-5`, with `FOCUS-6` joining the same row |
| `UI-6` render truth lens | `TRUTH-5` |
| `UI-7` taste lens | `TASTE-13` |
| `UI-8` experience lens | `UX-12` |
| `UI-9` surface class thresholds | `COVERAGE-1` Case 7 for the vocabulary; `TASTE-9`, `TASTE-5`, `UX-2` and `UX-5` for the bands |
| `UI-10` the verdict | the `## Verdict` table and line in the `quality.verify` receipt contract |
| `UI-11` who scores what | each topic's own closing rule, plus the receipt contracts that say which operator writes which table |

`FE-TEST-7` is retired into `FE-TEST-1` Case 7. `FE-IMPORTS-7` Case 9 is folded into Case 7 of the
same rule, which keeps its id.

New closing rules, each of the same shape — gating set, threshold, verdict, route: `A11Y-5`,
`FOCUS-6`, `COLOR-6`, `MOTION-5`, `TRUTH-5`. `TASTE-13` and `UX-12` already had one.

## The censuses that were moved out of the rules

A rule states a shape; the numbers that justified it belong here.

- **Paired specs.** In the reference application, 28 of 101 block folders and 22 of 49 page folders
  carry both an `index.spec` and a `component.spec`; 73 blocks and 27 pages carry one. `FE-TEST-1`
  Case 7 binds a new unit and legislates no sweep of that backlog.
- **Class literals in specs.** 57 of 272 component and index specs contain `toHaveClass` or
  `className`, across 167 calls; the other 215 assert roles, text and handed-down props only. Class
  proof has two dedicated homes there: two `classNames.spec.ts` files with 11 assertions, and six
  Grammar `styles.spec.ts` files.
- **The pure half choosing its own child.** 0 of 150 `component.tsx` files in the reference
  application hold a `data === null ? <X /> : <XBase …>` choice; its page indexes render the Base
  directly in 46 of 49 folders, re-export it in 1, and hand it to a local shell in 2. The second
  application repeats that ternary four times in one page.
- **Deployment constants.** The reference application reads `process.env.NEXT_PUBLIC_*` 7 times under
  its modules folder and 0 times under components. The second application has three block folders
  reading the same host suffix inline, each carrying its own default, so one environment change has
  three homes.
- **Currency and locale.** `currency: "VND"` appears 8 times in connected component files and 0 times
  under modules; the two locale literals appear twice in connected halves and 0 times under modules.
  The formatter is built where the locale is read, so the evidence points away from a shared money
  module — which is why `FE-FOLDER-6` Case 5 covers deployment constants only.

## What was deliberately not folded

- `knowledge/patterns/**` cites relative source paths and counts by design: its whole model is "every
  rule cites two real paths and records the dominant variant with its count", the citation gate is
  built on it, and the contributing page states it. Those paths name shapes inside a repository, not a
  product; the repository names and absolute paths that used to sit in the group's provenance lines
  are the one thing still worth removing, and doing so means redesigning that provenance model rather
  than editing a Case.
- Grammar object names stay in the rules. They are the published public API of a package, not product
  identity, and a rule about composing `WorkspaceShell` cannot state its shape without naming it.
- Session-first is stated in `SKILL.md`, in the orchestrator contract, and in the bootstrap the
  installer writes. That is three places on purpose: the bootstrap is the first text an agent reads
  and may not be a citation, and the orchestrator entry is the machine-readable half. The gate behind
  it is `SESSION_MISSING`.

---
id: fe-layouts-index
title: INDEX.md
slug: /fe/layouts
sidebar_label: layouts
sidebar_position: 0
description: Gate 1 of the chain — turns a raw prompt, an image or a feedback line into a page layout of archetype, regions, sections, overlays and states.
template: shelf-v1
---

# INDEX.md

Version: `1.01` · Shelf: `layouts` · Gate `1` of `5`

## What this gate takes and returns

    prompt / image / feedback → LAYOUTS → blocks → principles → patterns → lints → code

**Takes** a `LayoutBrief`, which is exactly one of three shapes and nothing else:

| Input shape | What arrives | Example |
|---|---|---|
| `chuoi-tho` | One raw sentence the founder typed, unparaphrased | "tôi muốn làm trang landing" |
| `anh` | A screenshot or reference image, optionally with marked regions | a blue box drawn around a rail |
| `phan-hoi` | A verdict on a `LayoutPlan` that already exists, with `rejected`, `chosen` and the verbatim `why` | the founder flipping his own earlier ruling |

**Returns** a `LayoutPlan`: `pageId`, `archetype`, `routeCluster`, `frameContract`,
`opensMainLandmark`, `regions`, `sections`, and optionally `overlays`, `states`, `owed`. That object
is not a summary for a human — it is byte-for-byte the input of
[`../blocks/gate.schema.json`](../blocks/gate.schema.json).

**Machine form of both:** [`./gate.schema.json`](./gate.schema.json). Where this file and the schema
disagree, the schema is the one a gate can run; a disagreement is a finding, not a choice.

This gate decides WHERE things sit and WHAT SURVIVES navigation. It does not decide what a region
contains — that is `blocks`. It does not decide seams, padding or planes — that is `principles`.

## Root law

Five sentences. Each carries an anchor, and nothing else in this shelf may contradict them.

1. **A page is a frame plus regions, and the frame is a registry key rather than markup.** No layout
   in the live tree writes a `<div>` of its own: every class and every `why` lives in the contract
   registry, and a layout only picks a key and fills slots.
   *Anchor: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:330` (`learn-shell-frame`
   holds its own classes and its own `why`).*

2. **A region is a sibling, never a wrapper.** A column beside the routed surface is a peer of it, so
   changing surface repaints the body and leaves the column standing.
   *Anchor: `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\component.tsx:20`
   — "THE SPINE IS A SIBLING OF THE ROUTED MAIN, never a parent."*

3. **A layout never receives `children`; it receives a component.** The one conversion point in the
   whole tree is `RouteShell`, which converts and does nothing else.
   *Anchor: `D:\Repositories\starci-academy-fe\src\components\shells\RouteShell\index.tsx:50`
   (`const Surface = useCallback(() => <>{children}</>, [children])`), and the reason at
   `…\RouteShell\index.tsx:18` — "IT CONVERTS AND DOES NOTHING ELSE - SHELL-6."*

4. **The frame does not open the document's `main`; the route file does.** A layout that drew one
   would put a second `main` landmark in the document.
   *Anchor: `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\component.tsx:13-15`.
   This law is currently BREACHED in the live tree — see `## Live breaches`.*

5. **Every sentence in this shelf carries an anchor or admits it has none.** A rejection anchor is a
   real `REJECTED` row in `.workflows` quoted verbatim from its `Why` column; a code anchor is a real
   `file:line` in the live repository `D:\Repositories\starci-academy-fe` (branch `main`). Anything
   else is written `suy luận, không có neo`. The three are never mixed inside one claim.
   *Anchor: `D:\Repositories\starci-academy-backend\.claude\fe\layouts\gate.schema.json:25` (the
   `Reason` contract that the four later gates `$ref` back to).*

## Routing to a module

Pick the archetype first; everything else follows from it. The folder name IS the value the gate
emits in `LayoutPlan.archetype`, so routing is checkable by string equality rather than by reading.

| `archetype` | Module | Choose it when | Frame contract | Serves |
|---|---|---|---|---|
| `sticky-chrome-band` | [`sticky-chrome-band/`](./archetypes/sticky-chrome-band/INDEX.md) | The reader must be able to LEAVE this page: the cluster carries brand, destinations and account tools above the body | `double-navbar` over `routed-page-main` | 6 route clusters, 49 of 51 pages |
| `destination-column` | [`destination-column/`](./archetypes/destination-column/INDEX.md) | One purchase opens MANY modes and the reader moves between them without losing the frame | `learn-shell-frame`, `personal-project-workspace-frame` | 33 pages (30 learn, 3 personal-project) |
| `subject-and-evidence` | [`subject-and-evidence/`](./archetypes/subject-and-evidence/INDEX.md) | The page is ABOUT a subject and the body shows changing evidence about that same subject | `profile-tabs-over-body` → `profile-rail-then-main` | 10 pages under `/profile/[username]` |
| `invisible-owner` | [`invisible-owner/`](./archetypes/invisible-owner/INDEX.md) | Nothing needs drawing; something needs to SURVIVE navigation | `playground-session-frame`, `global-ai-layout` | 2 playground pages, plus 51 pages minus 5 for the AI owner |
| `chua-co-archetype-do-duoc` | *no module* | None of the four fits and no shipped screen proves a fifth | — | see `## Owed` |

Archetypes compose. A learn page is `cot-dich-den` INSIDE `bang-chrome` UNDER `nguoi-giu-phien`.
Declare the archetype of the frame this plan OWNS, and name the enclosing ones in `routeCluster` and
in the region reasons.

## Routing the eleven layout laws

Every law extracted from the 552 real rejection lines lives in exactly one module. Two of them are
classification criteria rather than values, because the founder ruled both ways and both rulings are
binding.

| Law | Subject | Owner module | Kind |
|---|---|---|---|
| L1 | A persistent owner mounts once at the root; repeatable chrome does not | [`laws/l1-persistent-owner-mounts-once`](laws/l1-persistent-owner-mounts-once/INDEX.md) | fixed |
| L2 | The assistant and the page's content faces are different axes | [`laws/l2-assistant-and-content-are-different-axes`](laws/l2-assistant-and-content-are-different-axes/INDEX.md) | fixed |
| L3 | A page's section tabs are the navbar's second row, joined to it | [`laws/l3-section-tabs-are-navbar-second-row`](laws/l3-section-tabs-are-navbar-second-row/INDEX.md) | fixed |
| L4 | A tab changes a panel; a route changes a page | [`laws/l4-tab-switches-panel-route-switches-page`](laws/l4-tab-switches-panel-route-switches-page/INDEX.md) | fixed |
| L5 | Every route has a real page owner; which route is the DOOR is a product decision | [`laws/l5-every-route-has-a-real-owner`](laws/l5-every-route-has-a-real-owner/INDEX.md) | **criterion — founder flipped** |
| L6 | An overlay is already a surface; no card inside it | [`laws/l6-overlay-is-already-a-surface`](laws/l6-overlay-is-already-a-surface/INDEX.md) | fixed |
| L7 | Overlay width is a product decision, never "modals are narrow" | [`laws/l7-overlay-width-is-a-product-decision`](laws/l7-overlay-width-is-a-product-decision/INDEX.md) | fixed |
| L8 | Each field belongs to exactly one region | [`laws/l8-one-field-one-region`](laws/l8-one-field-one-region/INDEX.md) | fixed |
| L9 | A sticky offset subtracts the chrome of ITS OWN page | [`laws/l9-sticky-offset-is-page-local`](laws/l9-sticky-offset-is-page-local/INDEX.md) | fixed |
| L10 | A region's width belongs to that region's layout owner, not a sibling | [`laws/l10-region-width-belongs-to-its-owner`](laws/l10-region-width-belongs-to-its-owner/INDEX.md) | fixed |
| L11 | Full-width line versus compact control beside the figure | [`laws/l11-full-width-run-versus-compact-control`](laws/l11-full-width-run-versus-compact-control/INDEX.md) | **criterion — founder flipped** |

**L1's earlier statement is withdrawn.** It said a global visual owner must not mount into chrome that
repeats per route cluster — and `ShellNav` mounts in six of them (`cart`, `courses`, `dashboard`,
`league`, `practice`, `profile`), which a live test requires rather than merely tolerates. The law
only ever governed an owner holding state that must survive navigation. Six copies of one navbar is
the correct answer, and the module says so.
*Anchor: `D:\Repositories\starci-academy-fe\src\app\[lang]\authentication\layout-boundary.test.ts:24-25`
requires the mount inside the families that own it; `:18` keeps it out of the shell authentication
shares.*

**The three owed laws are now routed.** L2, L7 and L11 each hold a module of their own, so every row
in this table leads somewhere and no law is claimed by a neighbour that does not own it. `L6` cites
`L7` for overlay width and that citation now resolves; `L4` and `L10` both send a control's shape to
`L11`, which is where the criterion lives.

A criterion is not a default. Where a law is marked *criterion*, the module states both rulings with
both anchors and gives the question that separates them. Answering that question with "whichever we
did last time" is the failure the criterion exists to prevent.

## Live breaches

Measured, not repaired. Each is proved in the owning module's `audit.md`; none of them is licence to
copy the breach into a new plan.

| Breach | Where | Module |
|---|---|---|
| `<main>` inside `<main>` on 30 learn routes and course detail: `routed-page-main` declares `host: "main"` and wraps everything under `/courses`, while 23 page contracts declare `host: "main"` too | `contracts\index.ts:744`; `src\app\[lang]\courses\layout.tsx:32-39`; `contracts\index.ts:302,313,428,472,584,2009` | all four |
| The primary navbar still repeats `Trang chủ / Khóa học / Liên hệ` above course-detail tabs, which was rejected | `ShellNav\index.tsx:113-121` | `sticky-chrome-band` |
| `personal-project-workspace-frame` claims a milestone column in its `why` but flattens repeats as direct children and sizes `*:first-child`, so one NavLink gets the width, not a column | `contracts\index.ts:388,392,395` | `destination-column` |
| `PublicProfileLayout` declares five states and branches four; `loading` falls through to the ready tree and draws chrome over absent data | `PublicProfileLayout\component.tsx:15,101` | `subject-and-evidence` |
| `CourseLearnTodayPage` is mounted by no route, so `isToday` is never true and `TODAY_TABS` is unreachable | `LearnShellLayout\index.tsx:128,95-99` | `destination-column` |

## Proofs

[`./proofs/`](./proofs/INDEX.md) holds a held-out blind test of this gate on three screens the
founder is confident about: one agent read the source and recorded the real structure, another
received only the business requirement plus the gate and rebuilt from nothing. **41 of 82 scored
items hit — 50%, and the hit rate falls as the page gains layers.** A gate that scores half is a
gate, not a formality; read the scorecard before trusting a plan produced from these modules.

The scorecard names 18 rules the gate was missing. Where they land now:

| Missing rule | Now owned by |
|---|---|
| Parallel modes take a query param; a child route needs its own breadcrumb, metadata or landmark | `CHROME-5` |
| A silent requirement about shareable state is a question, not an inference | `CHROME-5` |
| Mode-switch bars and in-page navigation are route-cluster chrome, not the page's rail | `CHROME-2`, `CHROME-3` |
| Declare whether the threshold is viewport or container | `IDENT-2`, and `narrowMeasure` in the gate object |
| A narrow branch for EVERY archetype; a rail becomes a bottom bar only when it carries a commitment | `SPINE-2` versus `IDENT-2` — the split is by archetype, so each states its own narrow form |
| One page may carry several archetype layers at once | the routing note above: archetypes compose |
| `failed` and `not-found` replace the whole tree; only `failed` retries | `IDENT-5` |
| A branch unreachable from the live route is dead code, not a state | `SPINE-6` and its audit |
| Overlay mounted by the PAGE owner as a sibling of the page tree | **owed** — this shelf covers only the two layout-owned mount points |
| `restingCount`, empty regions absent from the tree, viewer standing as props, grid/list toggles, request ownership, cache keys, block order | **owed to `blocks`** — they decide what a region holds, not where regions sit |

## Owed

Written down instead of invented. An archetype earns a module from a shipped screen; a law earns a
sentence from a rejection line or a source line.

| Owed | Why it is not a module or a rule here |
|---|---|
| A fifth archetype | Only four archetypes have a live frame contract behind them. `chua-co-archetype-do-duoc` is the honest exit, and a plan that uses it must fill `owed`, not invent a folder. |
| Why the purchase rail is on the RIGHT | Grepped through the 1989 lines of `course-detail-ownership-and-rail.md`: the registry states mechanics only — "a left rail and a right rail are the same mechanics on opposite children" (`contracts\index.ts:2242`). The honest sentence is that the rail is a sticky supporting `aside` carrying the purchase decision, placed right by legacy and never challenged. No UX reason may be written for it. |
| Pages in no cluster | `[lang]\page.tsx` and `[lang]\authentication\page.tsx` wear no archetype. Two pages is not a pattern; measure a third before naming one. |
| Overlay interiors | L6 and L8 are provable only at the two mount points a layout owns (`ShellNav\index.tsx:162-170`, `GlobalAiChatLayout\index.tsx:77`). The insides of `CartDrawer`, `SignInOverlay` and `StarCiAiDrawer` are unmeasured. |
| A shell module | `src\components\shells\` holds six folders and four files: `SandpackShell\` and `ScrollShell\` are empty. A shelf module for an empty folder would be a rule with no subject. |
| Situation codes in the gate object | `gate.schema.json` carries `archetype` but has no `code` field on `Region` or `Section`, so a module's code is asserted today inside `reason.why` prose. Machine-checking the code against the module needs a schema change, which is a gate change and not this shelf's to take. |
| Runtime proof of every narrow claim | Every narrow-screen sentence here is read from Tailwind class strings. The px value of `md:` in this repo, the resolved value of the `@app-md` container query, and `document.querySelectorAll('main').length` on `/vi/courses/<id>/learn/content` are all unmeasured. |
| Gate status | `npm run gate:canon`, lint, typecheck and tests were not run while measuring. Whether any existing rule already catches nested `main` is unknown — and if one exists while the repo is green, that is a second finding. |
| History of the `routes: []` claim | `courses-runtime-projection-i18n-20260815-01.md:508` records shipping `routes: []` for course detail plus a test; live source has neither. Whether it was reverted or never landed needs `git log -p` on `ShellNav\index.tsx`, which was not run. |

## Version Rule

One accepted rule change increments the owning module by `0.01` across all five of its records and
adds a `changelog.md` entry. Changing this file — the root law, the routing tables, `Owed` — is a
shelf change and increments the shelf line above. A change to the shape of `LayoutPlan` is a GATE
change: it must be made in `gate.schema.json` first, because `blocks` reads that file and not this
one.

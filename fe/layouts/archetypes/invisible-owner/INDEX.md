---
id: fe-layouts-archetypes-invisible-owner-index
title: INDEX.md
slug: /fe/layouts/archetypes/invisible-owner
sidebar_label: invisible-owner
sidebar_position: 0
description: Binding rules for a layout that draws no frame and exists so that one thing survives navigation — its mount height, its companion planets, its reset policy and its hidden routes.
template: layouts-v1
---

# INDEX.md

Version: `1.00` · Module: `invisible-owner` · Shelf: [`layouts`](../../INDEX.md)

## Law

A layout may draw nothing at all. It exists so that ONE thing survives navigation — a socket, a
server session, an open conversation — and so that a failure can replace the routed surface instead
of decorating it.

**Mount height equals survival scope.** A thing mounted inside chrome that repeats per route cluster
dies at every cluster boundary. A thing mounted inside the provider tree is a visual owner in a place
that owns contexts, not composition. The mount point is therefore not a convenience; it is the
statement of how long the thing lives.

**Its companions are planets, not regions.** A trigger, a selection prompt and a drawer are optional
SIBLINGS of the routed surface. They do not split it, do not reserve space in it, and do not appear
in its reading order as a column.

**What stands still is DATA, not pixels.** The layout owns hooks and hands their value down by
context. The page repaints as much as it likes.

**A persistent axis is not a face of the page.** A global assistant and the page's content faces are
two different axes, and turning one into a tab of the other collapses both.

## Situation Codes

| Code | Situation | Emits |
|---|---|---|
| `KEEPER-1` | Something must survive across route clusters | mount at the locale root, through the one shell that converts children into a component |
| `KEEPER-2` | The keeper has visible companions | optional sibling slots of the routed surface, never a split of it |
| `KEEPER-3` | A persistent axis could be offered as a page face | it is not; the two axes stay separate |
| `KEEPER-4` | A connection or a session must outlive a route change | state lives in the layout's hooks and travels by context; `persistence: dung-yen-du-lieu` |
| `KEEPER-5` | Some of that state IS route-dependent | the reset is declared explicitly, keyed to what changes it |
| `KEEPER-6` | The keeper must not exist on some routes | one shared predicate, used by every owner that hides for the same routes |
| `KEEPER-7` | The thing the keeper holds failed to load | the notice REPLACES the surface; the two are mutually exclusive |

### `KEEPER-1` — the three candidate mount points, and why two are wrong

| Mount point | Verdict | Why |
|---|---|---|
| The provider tree | rejected | Providers own contexts, not visual composition |
| The route-cluster chrome | rejected | It is repeated by route clusters and would drop conversation state on cross-cluster navigation |
| The locale root | chosen | One mount above every cluster, through the existing shell boundary |

Both rejections are recorded verdicts, not preferences. The provider tree stays provider-only; the
band stays route-cluster chrome.

A keeper whose survival scope is ONE cluster mounts at that cluster's layout instead — the playground
session keeper lives at `playground\[slug]\layout.tsx` because a socket for that slug has no reason to
outlive the slug.

### `KEEPER-4` — the difference this archetype exists to name

Everywhere else in this shelf, "stands still" means pixels: a column that does not repaint. Here it
means data. `playground-session-frame` is `flex min-h-screen w-full min-w-0 flex-col` and nothing
else — there is no chrome to stand still. What stands still is the socket and the session, so moving
from setup to session does not rebuild the connection.

A plan that declares `persistence: dung-yen-pixel` for a keeper region has misread the archetype.

### `KEEPER-6` — one predicate, two owners

The keeper declares where it does not exist. So does the frame owner, for the same routes. Those two
declarations must be ONE function.

If each side grows its own route list, the shell can show navigation while the assistant hides — over
the same exam. The failure only appears to a person who is actually sitting the exam, which is the
worst possible place to discover a drifted list.

## Inputs

| Input | Evidence required |
|---|---|
| the thing that must survive | Socket, session, conversation — named, not implied |
| survival scope | Across clusters, within one cluster, or within one slug |
| companions | Every visible companion, and that each is optional |
| context consumers | Who reads the surviving value, and through what |
| reset policy | Which parts of the state are route-dependent, and keyed to what |
| hidden routes | Where the keeper must not exist, and who else hides on the same list |
| failure | What replaces the surface when the thing cannot load |

## Invariants

- The mount point matches the survival scope. Nothing wider, nothing narrower.
- The keeper is not mounted in the provider tree.
- The keeper is not mounted in chrome that repeats per route cluster.
- Companions are optional siblings of the routed surface.
- The keeper does not draw a frame, does not reserve layout space, and declares
  `narrowBehaviour: khong-doi` unless it measurably changes.
- Surviving state is `dung-yen-du-lieu`, and it reaches consumers by context.
- Every route-keyed reset is explicit and keyed to the thing that changes it.
- Hidden-route lists are one shared predicate.
- Failure replaces the surface; surface and notice are mutually exclusive.
- The persistent axis is never offered as a face of the page.

## Exceptions

- **`KEEPER-2` allows a companion to be visually prominent.** A floating trigger is a planet, not a
  region — prominence is not the test. The test is whether the routed surface had to give up space.
- **`KEEPER-5` resets narrowly, not wholesale.** In the live owner, exactly one piece of state resets
  on navigation — the code context, keyed to the anchor path. The conversation, its open state and the
  tangent counter deliberately do not. "Reset everything on route change" would delete the reason the
  keeper exists.
- **`KEEPER-6` hides for two reasons at once.** The live predicate hides on `/authentication` AND on
  four live-assessment route shapes. Result pages are excluded on purpose, because the live
  interaction has already ended there.
- **`KEEPER-1` permits a cluster-scoped keeper.** Not every keeper is global. The scope is the rule;
  the locale root is only where a GLOBAL scope lands.

## Anchor

Rejection anchors — path, line, verbatim `Why`:

| Code | Anchor | Rejected → Chosen | Why (verbatim) |
|---|---|---|---|
| `KEEPER-1` | `D:\Repositories\starci-academy-backend\.workflows\designs\starci-academy\global-ai-chatbot.md:708` | Mount chatbot inside `ShellNav` → Locale-root `GlobalAiChatLayout` | "`ShellNav` is repeated by route clusters and would drop conversation state on cross-cluster navigation." |
| `KEEPER-1` | `…\global-ai-chatbot.md:122` | Mount visual chatbot inside `AppProviders` → Mount once in an approved product shell/chrome owner | "Providers own contexts, not visual composition." |
| `KEEPER-3` | `…\global-ai-chatbot.md:710` | Keep disabled AI lesson tab → Remove AI face; add Source face; AI remains FAB/drawer | "Global assistant and lesson content face are different axes." |
| `KEEPER-3` | `…\global-ai-chatbot.md:120` | Promise page-aware or course-aware grounding in a global thread → Label global as not reading the current page | "Backend `global` is intentionally anchorless." |

Code anchors in the live repository `D:\Repositories\starci-academy-fe` (branch `main`):

| Claim | Anchor |
|---|---|
| Global keeper mounts at the locale root | `src\app\[lang]\layout.tsx:101` |
| The provider tree stays provider-only | `src\app\providers.tsx:1-60` — 16 provider mentions across the file, and zero `<div>`, `<main>` or `className` in it |
| The one conversion point | `src\components\shells\RouteShell\index.tsx:50`, reason at `:18` |
| Companions are optional siblings | `src\components\contracts\index.ts:2714-2722` (`surface`, plus `selection`, `trigger`, `drawer` all optional), `why` at `:2722` |
| A frame with no chrome at all | `src\components\contracts\index.ts:465` (`flex min-h-screen w-full min-w-0 flex-col`) |
| Surface and notice are mutually exclusive | `src\components\layouts\PlaygroundSessionLayout\component.tsx:23-33` |
| Cluster-scoped keeper: socket and session in the layout | `src\components\layouts\PlaygroundSessionLayout\index.tsx:52-53`, handed down at `:97` |
| Conversation state that survives | `src\components\layouts\GlobalAiChatLayout\index.tsx:32-34` |
| The one explicit route-keyed reset | `src\components\layouts\GlobalAiChatLayout\index.tsx:36-38` |
| The keeper mounts its own drawer | `src\components\layouts\GlobalAiChatLayout\index.tsx:77` |
| Hidden routes, one predicate, two owners | `src\modules\ai\content-ai-route-context.ts:64-68` and `src\modules\learn\is-live-assessment-route.ts:8-13`, reason at `:4-6` |
| The AI axis reads the route rather than occupying it | `src\modules\ai\content-ai-route-context.ts:23-49` |
| BREACH — one file, both halves, and no `shape` marker | `src\components\layouts\GlobalAiChatLayout\index.tsx:1-88`, marker at `:87` |

## Scope

This module owns layouts whose product role is survival rather than arrangement: the global AI owner
across 51 pages minus `/authentication` and four live-assessment route shapes, and the playground
session keeper across 2 pages.

It does not own the drawer's interior, the conversation blocks, or the playground surface. It owns
where the keeper mounts, what survives, what resets, where it does not exist, and how failure
replaces the surface.

A keeper composes with the other three archetypes rather than competing with them: the global keeper
sits ABOVE every band, and the playground keeper sits INSIDE one.

## Version Rule

An accepted rule change increments all five records of this module by `0.01` and is recorded in
[`changelog.md`](./changelog.md). A new mount point — anything other than a locale root or a cluster
layout — is a rule change, because `KEEPER-1` enumerates the candidates and rules two of them out by
verdict.

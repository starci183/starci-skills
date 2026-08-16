---
id: fe-layouts-laws-l2-assistant-and-content-are-different-axes-index
title: INDEX.md
slug: /gates/layouts/laws/l2-assistant-and-content-are-different-axes
sidebar_label: l2-assistant-and-content-are-different-axes
sidebar_position: 0
description: Binding rules for keeping the one global assistant and a page's own content faces on two parallel axes, and for exactly what a page may borrow from the assistant without owning any of it.
---

# INDEX.md

Version: `1.00` · Module: `l2-assistant-and-content-are-different-axes` · Law: `L2` · Refusals: **2 across 1 record**

## Law

The global assistant and the faces of a page's content region are **two axes running in parallel**,
not two values of one control.

The assistant axis has exactly one owner and it lives at the locale root. That owner receives the
routed page as a **component** and seats it beside itself rather than wrapping it, so navigation can
replace the lesson without replacing the conversation. The content axis is the finite set of faces
the page itself owns, and **none of those faces is the assistant**.

A page may **summon** the assistant, and it may **load grounding for the next question**. It may not
hold the assistant's open state, may not open a second conversation, and may not turn the assistant
into a tab.

The two refusals that settle it sit in the same record and point in opposite directions:

> Global assistant and lesson content face are different axes.

> User asked StarCi AI to explain code, not a second assistant/thread system.

The first blocks pulling the assistant down into the page's face list. The second blocks letting a
face grow an assistant of its own. Either one alone reads as a preference; together they are a
boundary with two sides.

**This is binding, not advisory.** Every assistant-adjacent thing a plan puts on a page falls under
exactly one code below, including the one that emits a refusal and the one that emits nothing
visible at all. The place this law gets skipped is never someone drawing a chat panel into a page
body. It gets skipped when a dead face is left in the tab list because it is already there and
merely disabled, when a page grows its own `isOpen` so it can "control" the drawer, and when a
narrower kind of question is given its own thread because that question felt like a different
feature.

The root owner keeps **publishing its context on the routes where it draws nothing**. A signed-out
viewer and a live-assessment route are classified situations rather than gaps, and a page consumer
reading the assistant there must not break.

This module decides **how many axes exist and which axis owns what**. How many times that owner
mounts and how high is [`l1-persistent-owner-mounts-once`](../l1-persistent-owner-mounts-once/INDEX.md).
What a pressed control changes, and whether the URL moves with it, is
[`l4-tab-switches-panel-route-switches-page`](../l4-tab-switches-panel-route-switches-page/INDEX.md).
What happens to boundaries inside the assistant's drawer is
[`l6-overlay-is-already-a-surface`](../l6-overlay-is-already-a-surface/INDEX.md).

## Situation Codes

| Code | Situation | What the plan declares |
|---|---|---|
| `L2-1` | An assistant must speak across pages | one owner at the locale root; the routed page arrives as a component and sits **beside** it, never inside it |
| `L2-2` | The plan enumerates the faces of a page's content region | the assistant is **not one of them**; a face that exists only to reach the assistant is removed, and where a real face is owed the real one takes the slot |
| `L2-3` | A page needs the assistant to speak about what that page is currently showing | the page **borrows**: it writes grounding for the next question and it may open the drawer, naming both calls |
| `L2-4` | A page holds the selection or the face that grounds the next question | the page clears the grounding when its own state leaves that face; navigation clears **that field and nothing else** |
| `L2-5` | A page wants its own thread, its own transcript, or its own open state | **refuse**, and write the want into `owed` — there is one conversation |
| `L2-6` | A route must not show the assistant | the same single mount keeps **publishing context**; only the visible composition is dropped, and page consumers keep reading |

Codes `L2-1` and `L2-2` answer *which axis does this thing belong to*. Codes `L2-3` to `L2-5` answer
*what the content axis may ask of the assistant axis*. `L2-6` answers *what the assistant axis still
owes a page on a route where it draws nothing*.

`L2-2` IS THE HALF PEOPLE READ AS COSMETIC. The refusal did not say the AI tab looked wrong; it said
the tab was on the wrong axis, and the correction shipped a **replacement of a different kind** —
the AI face left the row and a `source` face took its place. The live face union is `reading`,
`source` and `challenge`, and the dispatch beneath it names those three and nothing else.

`L2-3` AND `L2-5` ARE THE SAME SENTENCE FROM TWO SIDES. Borrowing is a page calling `open` and
`setCodeContext` on the one owner. Owning is a page holding `isOpen`, holding a transcript, or
opening a second session because the question is about code rather than about the lesson. The second
one was asked for once and refused in those words.

`L2-6` IS A SITUATION, NOT AN OMISSION. On a signed-out viewer and on every live-assessment route
the owner returns its provider wrapping the routed surface and stops: no `Tree`, no
`global-ai-layout` contract, no trigger, no selection ask, no drawer. Context still flows, and a
test pins it. Reading that branch as "the assistant is absent" produces a page that throws the
moment it calls `useGlobalAiChat`.

## Inputs

| Input | Evidence required |
|---|---|
| `assistantOwner` | the single owner by name, and the mount `L1` already settled — never re-decided here |
| `contentFaces` | the finite face union the page owns, listed by id, with the assistant absent from the list |
| `borrowKind` | `none` · `summon` · `ground-next-question` · `both` — what the page asks of the owner |
| `borrowedCalls` | the exact owner methods the page calls, by name; `isOpen` and any transcript field appearing here is `L2-5` |
| `groundingField` | the one field the borrowed context is written into, plus **every** writer that clears it |
| `hiddenRoutes` | the name of the predicate deciding where the assistant draws nothing — the same function `L1` reads |
| `consumersOnHiddenRoute` | whether any page reachable under that predicate calls the owner's hook |

`borrowedCalls` is an input rather than a detail because the difference between `L2-3` and `L2-5` is
not a feeling about scope, it is a list of method names. `open`, `setCodeContext`,
`clearCodeContext` and `startTangent` are borrowing. Reading `isOpen` into page state, or writing a
second session id, is owning.

`groundingField` asks for **every** writer, not the page's own, because grounding is the one field
both axes touch. The layout clears it when the address changes and the page clears it when its face
changes, and a plan that names only one of the two has not described what the reader will see.

`consumersOnHiddenRoute` exists because the hidden branch is the only place the two axes can be
separated by accident. The owner is allowed to draw nothing; it is not allowed to stop existing.

## Invariants

- One conversation, one owner, one open state. A page that needs a second thread has found a
  product question, not an implementation detail.
- The routed page is a passenger typed as a component, and the assistant is its sibling. A layout
  that wraps the page inside the assistant makes navigation and conversation the same event.
- No face of a page's content region is the assistant. A disabled face is still a face.
- A page may write grounding and may open the drawer. It may not hold `isOpen`, and it may not read
  `isOpen` into state of its own.
- Navigation clears the grounding for the next question. It does not clear the conversation and it
  does not close the drawer.
- Where a face writes grounding, that same face clears it when the page leaves the face. Grounding
  outliving the thing it points at is worse than no grounding.
- The owner publishes its context on every route, including the routes where it draws nothing, and
  every consumer of that context keeps working there.
- One predicate names the routes with no visible assistant, and the assistant axis and the frame
  owner read the same function.
- The assistant does not take the page's horizontal measure. It is fixed to the viewport corner and
  it opens over the page, so the content axis keeps the width it had before the assistant existed.
- What the assistant is grounded in is a separate decision from which axis it lives on. Adjacency is
  not grounding, and a plan may not promise page-aware answers because the two axes sit side by side.

## Exceptions

Exceptions are part of the law, not relief from it. Each is closed and names the code it modifies.

- **A face that grounds the assistant.** `L2-3`. The `source` face writes a code selection into the
  owner and opens the drawer, and that is the correct shape rather than a tolerated one. It stays
  inside `L2-3` because the page never holds the conversation and never holds the open state.
- **A page clearing the owner's field.** `L2-4`. `CourseLearnContentPage` calls `clearCodeContext`
  when its face leaves `source`, when the sandbox is reset, and when the selection is dropped. The
  page writes into the assistant axis here, and it is legal because the field is grounding for the
  next question rather than any part of the conversation.
- **Routes with no visible assistant.** `L2-6`. The single mount stays, the provider stays, the
  composition goes. Which routes those are belongs to the shared predicate and to `L1`, not to a
  list written again here.
- **Grounding scope is not decided here.** `L2-1`. The global thread is intentionally anchorless,
  and the refusal on that point says a surface context can only be a separately selected scoped
  session. That is a backend fact about what the assistant reads, and this module neither grants nor
  removes it.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The assistant is not a face of the page's content | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:710` | "Global assistant and lesson content face are different axes." |
| A face does not get a thread of its own | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:417` | "User asked StarCi AI to explain code, not a second assistant/thread system." |
| Adjacency is not grounding; the global thread is anchorless on purpose | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:120` | "Backend `global` is intentionally anchorless." |
| The one owner mounts at the locale root, above every routed page | neo CODE | `D:\Repositories\starci-academy-fe\src\app\[lang]\layout.tsx:101` | — |
| The page arrives as a component type, not as children | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:23-25` | — |
| The one conversion from framework children into that component | neo CODE | `D:\Repositories\starci-academy-fe\src\components\shells\RouteShell\index.tsx:48-52` | — |
| The owner holds three pieces of state and all three are the assistant's | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:32-34` | — |
| Navigation clears grounding only, and touches neither conversation nor drawer | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:36-38` | — |
| The published value, and the two places it is provided | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:40-54,58,65` | — |
| The context shape, and the architecture error thrown outside the root | neo CODE | `D:\Repositories\starci-academy-fe\src\modules\ai\global-ai-chat-context.tsx:8-18,21,24-27` | — |
| The branch that publishes context and draws nothing | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.tsx:56-62` | — |
| That branch is pinned by a test rather than by prose | neo CODE | `D:\Repositories\starci-academy-fe\src\components\layouts\GlobalAiChatLayout\index.test.tsx:44-49` | — |
| The one predicate naming the routes with no visible assistant | neo CODE | `D:\Repositories\starci-academy-fe\src\modules\ai\content-ai-route-context.ts:63-68` | — |
| The contract states the sibling relation in its own `why` | neo CODE | `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2714-2722` | — |
| The assistant does not take the page's horizontal measure | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:35` | — |
| `L2-2` landed: the face union carries three faces and no assistant | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\learn\ContentTabRow\component.tsx:26` | — |
| The dispatch beneath it names those same three and nothing else | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\learn\ContentTabRow\component.tsx:62-73` | — |
| `L2-3` landed: the page borrows the one owner beside its own face state | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnContentPage\index.tsx:95,101` | — |
| `L2-4` landed: the face that grounds also clears | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnContentPage\index.tsx:143` | — |
| The page summons the drawer and never holds its open state | neo CODE | `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnContentPage\index.tsx:373,385` | — |
| Three assistant consumers, none of which keeps a conversation | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiChat\index.tsx:42`; `…\blocks\ai\StarCiAiSelectionAsk\index.tsx:27`; `…\overlays\ai\StarCiAiDrawer\index.tsx:12` | — |
| The gate already carries the four regions of the assistant frame | neo CODE | `D:\Repositories\starci-academy-backend\.claude\gates\layouts\gate.schema.json:98-100` | — |
| The frame contract and the reused layout are both enumerable values | neo CODE | `D:\Repositories\starci-academy-backend\.claude\gates\layouts\gate.schema.json:473,500` | — |

## Scope

This module decides how many axes a page carries once a global assistant exists, and what each axis
is allowed to own. It does not decide the mount count or the mount height of the assistant, which is
`L1`. It does not decide whether a face writes the URL, which is `L4`. It does not decide what sits
inside the drawer once it opens, which is `L6`, and it does not decide what any face contains, which
is [`blocks`](../../../blocks/INDEX.md).

Its output feeds [`gate.schema.json`](../../gate.schema.json) at four points: `frameContract`, which
carries `global-ai-layout` exactly when the plan is declaring the assistant axis itself;
`reusesLayout`, which names `GlobalAiChatLayout`; the four `RegionRole` values `surface`,
`selection`, `trigger` and `drawer`; and `overlays[].mountOwner`, which is `layout` for the
assistant's drawer with `triggerRegion` set to `trigger`.

Two of this module's codes have **no field to land in**. There is no place in the schema for the
face union a page owns, and no place for a page declaring what it borrows from the assistant, so
`L2-2` and `L2-3` are asserted today inside `reason.why` prose. Adding either is a GATE change and
is made in the schema first.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A new situation code is a minor bump; changing the Law sentence is a major bump for the shelf,
because [`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) reaches the same owner from
the archetype side and the routing table in [`../../INDEX.md`](../../INDEX.md) states this law in one
line of its own. Adding a gate field for `contentFaces` or for `borrowKind` is a GATE change and is
made in `gate.schema.json` before it is written here.

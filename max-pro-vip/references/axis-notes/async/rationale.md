# ASYNC — what to draw for empty, error, loading, and who draws it

> This axis answers exactly one question: **what to draw for empty, error, loading, and who
> (atom/composite/block/screen) gets to draw it.** It does not answer what the skeleton shape
> looks like (see `skeleton/`), it only answers the FOUR BRANCHES of a data region and who is
> allowed to pick the branch. Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — four branches, there is no fifth branch

This is NOT an exported `type` enum (there is no `type AsyncState = ...` in the code). The
four branches are four conditions of a **real switch** in `AsyncContent.Base`, read directly
from `.storybook/components/composites/async/AsyncContent/AsyncContent.tsx` lines 185-224
(the priority-order comment is at lines 173-177):

| Branch | Real condition (`AsyncContent.Base` props) | Who draws the shape |
|---|---|---|
| `error` | `error` is truthy **AND** `errorContent` is supplied — outranks `isLoading` | `AsyncContentError` (lines 275-288) |
| `loading` | `isLoading` is true (when `error` has not fired) | the `skeleton` slot — the caller supplies its own `Skeleton.*` tree |
| `empty` | `isEmpty` is true (after passing `error`, `loading`) | `AsyncContentEmpty` if `emptyContent` is given, otherwise `null` |
| `content` | everything else | `content ?? children` |

SSOT for the scale: the JSDoc at lines 174-177 states the priority chain outright —
**"error → loading → empty → content"** — and the code at lines 200-212 is an if/else-if in
EXACTLY that order — this is the rare case where the SCALE and the DECISION TREE are ONE
thing, not two separate things.

---

## 2. DECISION TREE — ask in the exact if/else-if order from the code, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Does `error` have a value **AND** has `errorContent` been passed? | `AsyncContentError` — stop |
| 2 | (not yet) is `isLoading` currently `true`? | the `skeleton` slot — stop |
| 3 | (not yet) is `isEmpty` `true`? | has `emptyContent` ⇒ `AsyncContentEmpty`; none ⇒ `null` (the region hides itself) — stop |
| 4 | everything else | the real `content`/`children` |

**A second tree — WHO is allowed to call this branch** (kept separate from the tree above
because the canon has not locked it in — see §6/C1):

| # | Ask | Result |
|---|---|---|
| 1 | Is the blank region **the ENTIRE render function of the screen** (the id resolves to nothing)? | the SCREEN calls `AsyncContentEmpty` directly, returning early for the WHOLE thing — precedent: `CourseContents`/`ModulePage`/`MindMapPage` |
| 2 | Does the region have **its own frame that must be preserved** (card/accordion) while erroring/empty/loading? | the BLOCK decides the flag; if the frame already has its own axis (`isSkeleton`/`emptyState` of its own), USE THAT AXIS — do not force it through `AsyncContent.Base` — case: `SubmissionFindingsList` |
| 3 | Is the region loading without changing structure, just shimmering parts of itself? | not this axis — that's `isSkeleton` flowing down to an atom/composite that draws its own resting shape (§B7, does not go through `AsyncContent`) |
| 4 | Everything else (region has its own frame, is not the whole screen, is not just a shimmer)? | the BLOCK calls `AsyncContent.Base` (most cases: `LeaderboardBoard`, `SubmissionAttemptSelector`, `ConsultantDirectoryGrid`) |

An atom NEVER appears in the second tree: an atom does not know the data (canon B6,
`rules/1-decompose.md`), so it has no concept of "a region that is loading/erroring/empty" to
decide for itself.

---

## 6. FORBIDDEN

| # | Forbidden | Gate |
|---|---|---|
| 1 | Hand-writing if/else in an order other than `error → loading → empty → content` (e.g. letting `empty` override `error`) | cannot be gated — discipline, read the code |
| 2 | A screen importing `AsyncContent` (the switch) or `AsyncContentError` directly | NOT YET — gate needs to be written: scan imports in `pages/**` + `layouts/**`, flag red if either name appears (`AsyncContentEmpty` still has precedent, pending **C1**) |
| 3 | Calling `AsyncContentEmpty`/`Error` at the screen layer to replace only PART of the tree instead of an early return for the WHOLE thing | NOT YET — gate needs to be written: if `pages/**` has `isEmpty` and the `AsyncContentEmpty` JSX is not on an early-return branch wrapping the entire render function, flag red (trap #1) |
| 4 | A block wrapping `AsyncContent`/`AsyncContentEmpty` without adding any domain value (just renaming) | `check-passthrough-block.mjs` |
| 5 | `error`/`isEmpty` = true without the matching `errorContent`/`emptyContent`, assuming the branch shows itself automatically | cannot be gated — runtime behavior (trap #2) |
| 6 | Trusting a "fixed" log entry without cross-checking the real code on disk | cannot be gated — process discipline (trap #1) |

**Questions WITHOUT AN OFFICIAL ANSWER YET (bring to the teacher):**

- **C1** — the source looked up exactly as directed: `rules/1-decompose.md` §2 "hard table"
  (lines 100-106, updated 2026-07-28) ABSOLUTELY forbids a screen importing a composite, no
  exception noted. But §5 (line 155) of that SAME file — edited in the SAME commit
  `8c191396bb`, same day — lists this EXACT question as "waiting on the teacher to lock in" and
  states "Currently calling it directly". In other words this is NOT this axis's canon quoting
  a bad anchor — the rules contradict themselves, and that contradiction still stands as of
  today.

  Code measured on 2026-07-29: **6/6 precedents on disk import directly** —
  `AsyncContentEmpty` at the `pages/**`/`layouts/**` layer (`CourseContents`, `ModulePage`,
  `MindMapPage`, `PlaygroundPreparePage`, `FoundationResourcePage`,
  `HeadhuntingCompaniesLayout`) — no case routes it through a block. 5/6 cases follow a SHARED
  threshold that has not been written into §2: they only call it directly when it replaces the
  ENTIRE render function with an early return (standard: `CourseContents.tsx:115-117`);
  `FoundationResourcePage` alone drifts from that threshold — already closed above under trap
  #1 by code measurement, NOT part of what is being asked here. No case has ever called
  `AsyncContentError` directly at the screen layer.

  Two choices produce genuinely DIFFERENT shapes on disk: **(a)** add one exception line to §2
  ("except when it replaces the ENTIRE render with an early return") — keep the 5 precedents
  as-is, fix only `FoundationResourcePage` to match that threshold; fewest files changed.
  **(b)** drop the exception entirely, force all 6 precedents to split into their own
  `<Screen>EmptyState` block (matching §2 literally) — 6 new blocks + 6 new stories, changes
  the import tree of all 6 screens/layouts. WAITING ON THE TEACHER TO LOCK IN: pick (a) or (b)?

---
# PART B · LOOK UP WHEN DRIFT IS ALREADY SEEN — only open when Part A produces a drifted result
---

## 3. EXHAUSTIVE — four ORDERED branches (not a scalar scale) + the second axis of ownership

### 3a. Six state pairs — `C(4,2) = 6`, measured by DISTANCE in the priority chain `error(1)·loading(2)·empty(3)·content(4)`

**Three ADJACENT pairs (distance 1) — where real confusion happens:**

| Pair | The deciding test | Has actually bitten |
|---|---|---|
| `error` ↔ `loading` | **Is `error` set AND is `errorContent` given?** Yes ⇒ `error` ALWAYS WINS even while `isLoading` is still `true` (e.g. a background refetch after an error already occurred) — there is no such thing as "loading means the error has to wait". | `SubmissionFindingsList`'s file header, lines 66-68, states this exact rule itself ("Error still outranks a stale isLoading/isSkeleton") |
| `loading` ↔ `empty` | **Is `isLoading` already confirmed `false`?** An empty array is NOT automatically "truly empty" if the initial request is still in flight — you must wait for `isLoading=false` before trusting `isEmpty`. The caller reduces the condition itself, `AsyncContent` never infers it. | anchor: JSDoc lines 133-136 "Pass an already-reduced condition, e.g. `isLoading && items.length === 0`" |
| `empty` ↔ `content` | **Count the real `length`, don't infer from another falsy value.** `undefined` (fetch not finished yet) is NOT `isEmpty=true`; only an array that has finished fetching and has length 0 is `isEmpty`. | anchor: `emptyContent` is optional, "Left empty → the empty branch renders null" (lines 146-148) — a missing config is mistaken for "empty but silent", not "not yet known" |

Pairs 2 or more steps apart: hesitating there is a sign the tree was drawn wrong, not that the
wrong value was picked (cross-axis rule 3 in INDEX.md). Go back to §2.

Recount: 3 + 2 + 1 = 6 = `C(4,2)`. Complete.

### 3b. The second axis — who owns it (`atom`/`composite`/`block`/`screen`) — stopping criterion: all 4×4 = 16 cells, each one labeled

| State | `atom` | `composite` | `block` | `screen` |
|---|---|---|---|---|
| **error** | does not know the data | `AsyncContentError` draws the shape when told to | OWNS the decision + picks one of 2 paths (`AsyncContent.Base` or its own bounded case, e.g. `SubmissionFindingsList`) | no case seen yet — 0/34 `pages/**` files import `AsyncContentError` |
| **loading** | (an atom's own resting shape is a different axis, `skeleton/`) | `AsyncContent.Base` receives `isLoading`, shows the `skeleton` slot | OWNS both the decision and the shape: combines `isLoading`+`isSkeleton` into one branch, draws its own `Skeleton.*` tree | only FORWARDS `isSkeleton` down to each block (§B7), does not draw anything itself |
| **empty** | | `AsyncContentEmpty` draws the default shape (`TrayIcon`+title+action) | USUALLY: computes `isEmpty`, calls `AsyncContent.Base` or calls the bounded case directly within its own frame | HAS PRECEDENT BUT NO LOCKED-IN RULE YET — see §6 C1 |
| **content** | (is the raw material, does not "own" the whole region) | only forwards `content ?? children`, does not create content | OWNS it — supplies the real `content`/`children` | only arranges blocks within the frame, has no content of its own |

---

## 4. STRUCTURAL TRAPS — wrong not because the wrong branch was picked, but because who's allowed to call it was misread

1. **Wrapping in a local function is NOT a real layer split.** `FoundationResourcePage.tsx`
   lines 111-123 define `FoundationResourceEmpty` as a NON-EXPORTED function right inside the
   screen file itself, then call `AsyncContentEmpty` inside it — it looks like "a block has
   already been split out" but it is still SCREEN-LAYER code (not inside `blocks/**`, no story
   of its own). `steps/13-feedback-anatomy-registry.md` lines 1574-1579 records that the
   CORRECT fix is "split out a NEW BLOCK `FoundationResourceEmpty` … + its own story", but a
   full-repo grep on 2026-07-29 (`grep -rl "FoundationResourceEmpty" .storybook/components`)
   still turns up EXACTLY 1 file — `FoundationResourcePage.tsx` itself.

   **ALREADY SETTLED (by code measurement, no need to ask the teacher):** reading
   `FoundationResourcePage.tsx` lines 34-36 and 156-193 directly confirms TWO things, not one
   open question: (a) the fix logged as done has NOT actually landed on disk; (b) that file's
   own header comment MISQUOTES `CourseContents`'s real behavior — it claims "same idiom
   `CourseContents` uses … scoped to the part", while `CourseContents.tsx` lines 115-117
   (`if (isEmpty) return <CourseContentsEmpty />`) really does return early for the ENTIRE
   render, not "scoped" at all. `isEmpty` in `FoundationResourcePage` only replaces PART of the
   screen (lines 159-165: `TrialEnrollBanner` sits OUTSIDE the `isEmpty` switch) — this is a
   VIOLATION confirmed by code measurement, not an open question for the teacher. The
   misquoted anchor sits RIGHT IN THE SOURCE (that file's own comment), not in this axis's
   canon.

   The question that is ACTUALLY still open (whether a screen may call a composite directly,
   even when replacing the ENTIRE screen) has been folded into §6 question **C1** — written up
   there in full with the two concrete choices; not repeated here.

2. **`error`/`isEmpty` = true but missing the matching props falls through to the branch
   below, silently.** `error` is truthy but `errorContent` is missing ⇒ line 200's
   `if (error && errorContent)` is false ⇒ it falls through to the `isLoading` check as if
   there were no error at all. `isEmpty` is true but `emptyContent` is missing ⇒ draws `null`,
   the region disappears silently (lines 146-148, 206-208). It's easy to assume "just setting
   the flag makes the branch show itself" — wrong, you must also supply the matching content
   props.

3. **A layout calling a composite directly is a "deliberate exception", not a pattern to
   copy.** `HeadhuntingCompaniesLayout.tsx` lines 31-39 admits it outright: the real navigation
   rail has NOT been built yet, so it uses `AsyncContentEmpty` as an honest placeholder instead
   of faking a `div`. This is a LABELED gap for a block that DOES NOT EXIST YET — not a
   precedent for skipping the import boundary when a block already exists but wiring it up
   feels inconvenient.

---

## 5. REAL ANCHOR — priority order when two sources clash

1. **The real code of `AsyncContent.Base`** (lines 173-224) — the highest-priority source for
   the PRIORITY ORDER of the four branches (§1/§2 above). No source may flip
   "error → loading → empty → content".
2. **Existing precedent** (read each page/block directly) — use this to decide "who calls it"
   (block or screen), since canon B7 is only 3 lines and doesn't cover every case in enough
   detail.
3. **Notes in the file header of the component itself that is drifting from the default**
   (`SubmissionFindingsList`, `PlaygroundPreparePage`, `HeadhuntingCompaniesLayout`) — REAL
   EVIDENCE for the REASON a case is deliberately unusual, but NOT a locked-in rule if another
   case (`FoundationResourcePage`) contradicts it — see TRAP #1.
4. **`steps/13-feedback-anatomy-registry.md`** — records the INTENT of a fix, NOT proof it was
   applied. Always cross-check the real disk (`git log`/grep) before trusting a log line.
5. **`rules/1-decompose.md` §B7** — the general 3-line canon, use it when none of the above has
   a specific case (see `example.html` §1 for a full anchor).

Specific anchor per branch: [`example.html`](example.html).

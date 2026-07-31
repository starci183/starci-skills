# Comments — WHEN to write one — STRICT

> A comment is debt that pays interest every time the code changes. Write one only when it says
> something THE CODE CANNOT SAY. Every example below is real code on `mtp`.

## 1. A comment is WHY, never WHAT

- Write one when there is a **constraint, a workaround, or a non-obvious decision** that whoever
  edits this next needs to know in order not to break it:

```tsx
// src/components/blocks/cards/GroupPressableCard/index.tsx — explains WHY it is opt-in
// Press 1–N to act without reaching for the mouse. Opt-in: the listener is
// on `window`, so a group that isn't the screen's main action would steal
// every digit the page sees.

// src/components/blocks/chips/StatusChip/index.tsx — records the design rule behind a render branch
{/* leading status icon — DROPPED when the chip is removable (has a
    trailing cancel-X): a chip carries EITHER a status icon OR a cancel-X,
    never both. */}

// src/components/features/architecture/hooks/useSystemHealthPoll.ts — why useMemo with empty deps
// stable per-mount jitter (not re-rolled every render)
```

### Not every WHY survives — a constraint keeps, a decision's history does not

"A non-obvious decision" is where this rule leaks. A **constraint** and a **decision** both answer
"why", and only one is worth writing down:

| | |
|---|---|
| **the code has to be like this** | keep. A vendor rule out-specifies yours, a value must stay in sync with another file, an order of operations matters. Delete it and the next reader writes the bug back |
| **somebody decided this on a date** | delete. When it was changed, which review caught it, what it used to be, whose scope it was in. Delete it and nothing breaks |

> **Test:** would this comment still be worth writing if nobody remembered the change that caused
> it? A constraint still would. A decision's history has nothing left to say.

Never write a comment claiming something is *intentional*, or that something was *out of scope*.
Intent and oversight leave identical code, so the claim cannot be checked — and the reader who
believes it stops looking. "This branch does not do X" is honest and useful. "X is intentionally
not done here" is a claim about somebody's mind, and it converts a bug into documented behaviour.

Reading side of the same rule: [`max-pro-vip/references/house-rules.md`](../../max-pro-vip/references/house-rules.md)
§2 — *a comment is a claim, not evidence*.

- Never restate what the code already says:

```ts
// Wrong: // reset the input
//    setBody("")
// Wrong: // loop over the items
//    items.forEach(…)
```

## 2. Do not re-describe a name that is already clear — delete the redundant comment

- A good function or variable name IS the documentation ([[naming-and-structure]]).
  `hasNonEmptyString`, `stripLocale`, `onSeeMore` need no `// check if string is non-empty` above
  them — DELETE such lines when you touch the file.
- Find a comment that misdescribes the current code → fix or delete it IN THE SAME DIFF, never
  "later". **A wrong comment is worse than no comment** — the next reader trusts it instead of
  reading the code.

## 3. JSDoc for public API and props — continues [[props-and-types]] §2

- Every prop or field of an exported interface gets a one-line `/** … */` saying **what it does,
  its default, and when it hides or falls back**:

```ts
// src/components/blocks/async/AsyncContent/index.tsx
/**
 * Truthy → the {@link ErrorContent} is shown (takes priority over loading).
 * Pass the SWR `error` (only when there is no cached data to fall back to).
 */
error?: unknown

// src/components/features/architecture/hooks/useSystemHealthPoll.ts — the meaning of null, written AT the field
/** Live health keyed by component name, or `null` before the first resolve. */
healthByName: HealthByName | null
```

- An exported component or hook opens with a JSDoc block: its role, what it composes, its
  behavioural rules. `AsyncContent` states the priority order `error → loading → empty → content`;
  `useSystemHealthPoll` states its honesty rule, "null = checking, NEVER up".
- An exported module-level helper or constant gets one line too:
  `/** Resolve a hit's kind to its presentation, defaulting unknown kinds to content. */`.
- A bare prop with no JSDoc is out of standard, including an "obvious" one.

## 4. No commented-out code left lying around

- Dead code gets **DELETED**; git keeps the history. The repo is currently CLEAN — zero
  commented-out blocks. Keep it that way.
- Neither `// const oldHandler = …` nor `{/* <OldCard … /> */}` is acceptable as a "for reference"
  keepsake — for reference, use `git log -p`.
- The ONLY exception: kept briefly within the SAME work-in-progress commit chain, and only with a
  `TODO` carrying context (see §5). It never merges to `mtp` in that state.

## 5. TODO and FIXME carry CONTEXT and a condition for removal

- A valid TODO says **why it is not done and when it will be** — a stranger can read it without
  asking anyone:

```ts
// src/components/features/learn/MockInterview/MockInterviewSession/index.tsx
// "Luyện thiết kế hệ thống" is only offered for a System-Design course — its
// capstones are architecture systems, the only ones the unchanged 5-phase
// script fits.
// TODO: refine to "a module large enough for a design interview" once a
// non-SD track has a capstone that size, rather than gating by track alone.
const isDesignAvailable = courseDisplayId.includes("system-design")

// Wrong: // TODO: fix this
// Wrong: // FIXME later
```

- Editing code around a comment → RE-READ that comment and update it in the same diff. A comment
  narrating older code — wrong branch count, wrong prop name, wrong priority order — is a
  documentation bug, and review stops it there.

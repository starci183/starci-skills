# SEAM — the distance between two things (`gap`)

> This axis answers exactly one question: **how far apart are these two things.**
> It does not answer padding (see `inset/`), and does not answer margin (margin is FORBIDDEN,
> see §6).
> Real code anchor: [`example.html`](example.html).

---
# PART A · RECOGNITION — load this part when SCANNING
---

## 1. THE SCALE — six steps, there is no seventh step

| Step | Class | px | Relationship |
|---|---|---|---|
| `flush` | `gap-0` | 0 | ONE unit of meaning — the title and subtitle of the same line |
| `tight` | `gap-1` | 4 | A MARK attached to a single thing — an icon before a label, a unit after a number |
| `related` | `gap-2` | 8 | PEERS within a set — a row of chips, two buttons, a name and a timestamp |
| `grouped` | `gap-3` | 12 | ROWS stacked within one surface — a list row, an avatar next to a content column |
| `section` | `gap-6` | 24 | different REGIONS of one block — the header, body, footer of a card |
| `page` | `gap-8` | 32 | separate BLOCKS on the page — block next to block |

SSOT of the scale: `SeamScale` in `.storybook/components/frames/_spacing.ts`. Writing a number
(`gap={3}`) is a **compile error**, not a lint error.

---

## 2. DECISION TREE — ask top-down, stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Delete one and the other **loses meaning or loses context**? (a number and its unit, an icon and its label) | `flush` or `tight` — go to §3 pair 1 |
| 2 | The two things are **the same kind, repeating, neither one is the lead**? (a row of chips, a row of buttons) | `related` |
| 3 | The two things are **different roles but together form one identity line**? (name · badge · time) | `related` |
| 4 | The two things are **several different regions within the same larger unit**? (header/body/actions of a comment) | `grouped` |
| 5 | The two things are **separate functional blocks, each able to stand on its own as a feature**? | `section` or `page` — go to §3 pair 5 |

**Before trusting the tree's result: if the component has a real `src`, MEASURE that source and
use the measured number.** The tree is only the fallback when there is no source. See §5.

---

## 6. FORBIDDEN

Each row below is a rule that is **machine-checkable**. The last column shows whether a gate
exists yet.

| # | Forbidden | Gate |
|---|---|---|
| 1 | Writing a NUMBER for `gap` (`gap={3}`) instead of a word | `tsc` — `SeamScale` is a union literal |
| 2 | A child of a frame carrying `margin` (except the whitelist `mt-auto` · `ms-auto` · `-mx-*`) | `check-padding.mjs` |
| 3 | Writing layout by hand (`flex`/`grid` + `gap-*` in `className`) from the `composite` tier upward | `check-seams.mjs` |
| 4 | A child of a frame carrying `margin` at the same time the parent has `gap` (two owners for one seam) | `check-padding.mjs` (rule `child-margin`) |
| 5 | Using a value outside the scale (`gap-1.5` · `gap-4` · `gap-5`) | `check-seams.mjs` |
| 6 | Copying a seam from a different component that doesn't share the same `src` (trap §4.5) | not gateable — a discipline |
| 7 | Reporting done after only reading the code, without measuring `getComputedStyle` | not gateable — a discipline |

2026-07-29 fixed two mis-declared lines: line 3 now applies from the `composite` tier upward
because `tierOf` now reads the real folder name correctly; line 4 is caught by
`check-padding.mjs`, not `check-seams.mjs`.

---
# PART B · LOOK UP ONCE DRIFT IS SPOTTED — open only when Part A comes back off
---

## 3. EXHAUSTIVE EASY-TO-CONFUSE CASES — all 15 pairs

A 6-step scale ⇒ `C(6,2) = 15` pairs. List all 15, no cherry-picking.

### 3a. Five ADJACENT pairs — this is the whole battle

**Evidence for why the fight only happens here: 4/4 real logged seam bugs were all adjacent
pairs.** Not one has ever drifted by ≥2 steps. See the anchor in `example.html` §3.

| Pair | The DECISIVE deciding test | Has actually bitten |
|---|---|---|
| **`flush` ↔ `tight`** | Are both things TEXT? Both are text and read together as one idea (a title above, a subtitle below) ⇒ `flush`. One of them is **not text** (an icon, a dot, a rule) or is a bound suffix (a unit) ⇒ `tight`. | 1 time |
| **`tight` ↔ `related`** | **MARK or PEER.** Delete one: the rest **still stands complete on its own** ⇒ two PEERS ⇒ `related`. The rest still has meaning but **loses the context the other one supplied** ⇒ MARK ⇒ `tight`. | 2 times |
| **`related` ↔ `grouped`** | **CAN THE ORDER BE SWAPPED.** Swap the two and the meaning doesn't change ⇒ PEER ⇒ `related`. Order carries meaning, **or each row is a different KIND** ⇒ rows of one surface ⇒ `grouped`. | 1 time |

The remaining two adjacent pairs have never actually bitten — only theoretical risk so far:
`grouped`↔`section` · `section`↔`page`.

### 3b. Four pairs ONE STEP APART — rare, but there is a dividing line

| Pair | How to read it |
|---|---|
| `flush` ↔ `related` | Hesitating here means you haven't answered "is this ONE idea or TWO ideas" yet. Answer that first, then come back to §3a. |
| `tight` ↔ `grouped` | Almost always caused by misreading a MARK as a ROW. A MARK is never a row of a surface — it can't stand on its own. |
| `related` ↔ `section` | If you're comparing a PEER against a REGION, the two things you're comparing aren't at the same level. Redraw the tree one level up. |
| `grouped` ↔ `page` | A row within one surface is never equivalent to a block on the page. Confusing these means the tree is wrong. |

### 3c. Six pairs ≥2 STEPS APART — no deciding test, and deliberately so

`flush`↔`grouped` · `flush`↔`section` · `flush`↔`page` · `tight`↔`section` ·
`tight`↔`page` · `related`↔`page`

Pairs 2+ steps apart: hesitating there is a sign the tree was drawn wrong, not a sign of picking
the wrong value (cross-axis rule 3 in INDEX.md). Go back to §2.

---

## 4. STRUCTURAL TRAPS — wrong not because of picking the wrong number, but because the tree was misread

Six traps below have **all actually bitten**. They don't show up in the §2 tree because they
happen BEFORE the step of picking a value.

1. **`gap` with no one to receive it.** Passing `gap` into a frame that only applies gap on a
   different branch gets it **silently dropped**: no compile error, no lint error, no warning at
   all.
   ⇒ After fixing, you must **measure `getComputedStyle`**, not read the code and trust it.
   The API state of each frame is the `frame` axis's job (see `frame/rationale.md` §4) — this axis
   holds no concrete anchor about any frame, since an anchor like that drifts every time the
   frame's props change, and it has actually drifted once already: an earlier version of this
   section still described a `Container` prop that was removed on 2026-07-27.

2. **Two owners for one seam.** The parent sets `gap` while the child also carries `margin` ⇒
   two sources add together, and no one can read out the final number. A seam has exactly ONE
   owner: the parent frame.

3. **Reading by TIER instead of by RELATIONSHIP.** The §1 table saying "different regions ⇒
   `section`" does not mean "two composites are always `section`". Two composites where **one is
   a caption for the other** are one cluster ⇒ `grouped`. The relationship decides, not the tier.

4. **Assuming nested seams must shrink evenly.** There is no rule forcing a child seam to be
   smaller than the parent seam. **Every seam is an independent decision.** Anchor: `CommentItem`
   has a `gap-3` parent whose child is also `gap-3`.

5. **Inferring this component's seam from a component that "looks the same".** Measured
   counter-evidence: same "content column" shape, `QuestionRow` is `gap-1` while `CommentItem` is
   `gap-2` — **both are correct**, because each anchors its own source. Cross-inferring is the
   surest way to get half the cases wrong.

6. **A near-uniform rhythm is a warning sign.** Listing seams top to bottom: a sequence that's
   nearly all the same (`24/12/24/24`) means the rhythm can't tell any groups apart. A correctly
   structured sequence must be able to **name a group** (`24/12/12/24`).

---

## 5. REAL ANCHORS — priority order when two sources clash

1. **The real `src` of the CURRENT component being edited** (declared in the file header "ported
   from…") — MEASURE it.
2. Decision tree §2 — use only when (1) doesn't exist.
3. Examples from outside the codebase (Facebook, GitHub…) — **reference data only**, to see
   whether the industry converges, **never** a substitute for (1). Anchor: GitHub uses `4px` for a
   byline row, this app uses `8px`, both are correct in their own context.

Anchors for each branch specifically: [`example.html`](example.html).

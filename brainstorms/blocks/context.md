# Blocks

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `brainstorms/blocks/schema.json` | file | validate the record's JSON shape |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |

## Record

You are given one region of the current source page and its routed visual vocabulary, and you return 3–4 materially
distinct block anatomies inside the complete parent page, rank them and select the strongest — or one refusal
naming missing product truth. The model owns visual and compositional judgment; JSON records and proves it.

## Law

An anatomy names the parts, how many times the block rests, every state it draws, and who owns its data.
It never names a class.

**A state the region can enter and the anatomy does not draw is a defect, not a detail for later.** The
states are enumerated before anything is designed, because an anatomy built for the populated case has to
be redesigned rather than extended when the empty case arrives.

## Inputs

Seven, and no more.

| # | Input | Without it |
|---|---|---|
| 1 | The current source region and its business reason | there is no subject, only a shape |
| 2 | The validated four-lock baseline and current parent digest | anatomies get built under a partial or wrong parent |
| 3 | StarCi MASTER and deviations-only page override | each block quietly chooses its own taste |
| 4 | Contract: **key**, `why`, `host`, children **names**, `repeats`, `optional` — not the class arrays | parts get invented instead of looked up |
| 5 | Vocabulary: leaf names the contract cites, composite names, blocks that exist | a part cites a component that does not exist |
| 6 | How the region's data actually fails, read from page and block source | `optional` gets mistaken for a full state set |
| 7 | The closed list of anatomy axes | the 3–4 anatomies differ by decoration |

**Input 6 exists because the contract cannot answer it.** `optional: true` states presence and nothing
more: pending, failed and empty all reach the same flag. Separating them is read from the page and block
source, never assumed from cached review state.

Not read at this stage: class arrays, unaccepted theme choices, locale copy, lints.

## Reading a current region

1. **Require the current source parent and bind its digest as `parentAt`.** Cached review output from another task is not a starting point.
2. **Enumerate the conditions and states first.** Viewport, overlay, disclosure, async, data, permission and
   interaction conditions come before anatomy. Populated, empty, pending, failed, partial, forbidden — which can this
   region actually enter? Read it from source; do not infer it from `optional`.
3. **Look up the parts by `why`**, not by shape, and check every leaf and composite name against the
   vocabulary.
4. **Choose the axes** the anatomies will differ on. Identical axis sets are one anatomy.
5. **Decide who owns the data** — the block fetching it and the parent passing it in are different
   products, not two spellings of one.
6. **Refuse rather than invent.** Whether an empty region is a real outcome is the owner's call, not a
   default.

## Anatomy axes

| Axis | Values |
|---|---|
| data owner | the block fetches it / the parent passes it in |
| repetition | one instance / repeats with a resting count |
| weight | the populated state carries the block / an absent state carries it |
| composition | one part / label with value / label with visual and caption |

`repeats` without a `restingCount` is refused: a repeating block with no resting count has no shape to
review.

## Per-part verdict

Every part resolves to exactly one of three, against the contract and the vocabulary:

| Verdict | When | Evidence owed |
|---|---|---|
| `reuse <key>` | a name's `why` already answers this part's reason | none |
| `generalize <key> -> <key>` | it answers it under a feature-bound name | the call-site count of the old name, **and the rewritten `why`** |
| `new <key>` | nothing answers this reason | the `why` the new name will carry |

A citation that cannot be checked against the vocabulary is an invented name, whatever its verdict says.

## Anatomy laws

Fourteen laws every anatomy must satisfy. An anatomy that breaks one is not a weaker option — it is not
an anatomy.

| Code | Law | What it rejects |
|---|---|---|
| `BLOCK-1` | A block draws at most one surface that claims page ground. A boundary inside it is legal only when the inner set is a separate, nameable membership that declares itself nested: one border, no shadow, a named outer owner. | a card drawn inside a card |
| `BLOCK-2` | A secondary field in a row is text. A chip is reserved for a real state of the object: a fact that changes on its own, carries a consequence, and whose tone means something. | chrome used as emphasis — a pill around a number |
| `BLOCK-3` | A block owns its inset, its scroll, its measured limits and its own presentation state. The caller supplies position and data, and nothing else. | a caller reaching in to style or size the block |
| `BLOCK-4` | Empty is a state of the block, not the absence of the block. Zero results is an answer the product gives, in the block's own shell under its own name. | removing the block when the data is empty |
| `BLOCK-5` | A block draws only facts a producer serves. No field means no field — not a constant, not a placeholder, not a plausible number. | an invented field, which is worse than a missing one because it is not visibly absent |
| `BLOCK-6` | Two places that show the same thing share one real owner: the shared visual row is merged, the differing interaction host stays apart. | merging on resemblance alone, or quoting half the law |
| `BLOCK-7` | In a repeated block, columns line up across every row, and content that opens sits flush with the trigger that opened it. | alignment decided per row |
| `BLOCK-8` | Name the group first, choose the spacing second. Spacing cannot substitute for structure. | a layout tuned by adjusting distances until it looks right |
| `BLOCK-9` | The name of a list surface belongs to the list branch. Hiding the name is legal only when an enclosing owner already renders that exact resolved name. | a heading drawn outside the list with the name hidden inside it |
| `BLOCK-10` | List every state before drawing any of them. A state is a situation that picks a different tree; anything drawing the same tree with different words is a prop. | designing the populated case and discovering the rest later |
| `BLOCK-11` | Every action owns its own pending flag, and one block is one settling unit. | one shared loading flag across several actions — a spinner on the wrong button |
| `BLOCK-12` | A failure has a visible owner in every layout. A failure is a settled answer, not a wait. | an error rendered as a spinner that never resolves |
| `BLOCK-13` | A block accepts closed data. It never accepts arbitrary content and never lets the caller decide what appears inside it. | arbitrary content, which makes the block a branch |
| `BLOCK-14` | Proposals are per block. A surface with `N` blocks is judged region by region; alternatives stay inside their owning region. | turning several block decisions into page-wide combinations |

## Rules

1. An anatomy carries no class, no token, no colour.
2. The condition/state set is enumerated before the anatomy is designed, and the anatomy draws all of it. Modal,
   drawer, popover/menu, loading, empty, error, locked and disabled surfaces are included when reachable; an
   irrelevant family is explicitly `not-applicable` with evidence.
3. A business-content matrix names the real entity, representative fields, counts, statuses, actions,
   consequences and density for each state. A title plus a few generic rows is not representative content.
3. `repeats` carries a `restingCount`.
4. Every part cites a name that exists, or declares a new one with its `why`.
5. No two anatomies in a batch share the whole axis set.
6. Return 3–4 anatomies. Each changes meaningful grouping, repetition, hierarchy or interaction ownership;
   decoration alone is a duplicate. Rank the valid set and select one.
7. A missing product decision is returned to the owner.
8. The JSON is canonical, and its hash is what approval attaches to.
9. Feedback opens a new round; an accepted anatomy is never edited in place.

## Refusal

Refusal is an output. It is used when:

- the request does not say whether an empty region is a real outcome;
- who owns the data cannot be determined from the region or the source;
- the resting count is unstated and the region gives no basis for one;
- a part requires a component that does not exist, which makes it a **contract or component change**
  rather than an anatomy choice.

```text
refusal: returned-to-owner
missing: <the decision nobody has made>
blocked: <which parts cannot be resolved without it>
```

## Output

The output **is** JSON, and its authority is `@schema` beside this record. `envelope`
holds what varies between runs — including the session-local `parentAt` digest of the current source page.
The anatomy hash is a cache key only and covers one anatomy.

```json
{
  "schema": 1,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "region": "criteria",
    "parentAt": "f5534ef5e7fbe30c385108fb95702a64ac66d905414e0f7105873d67822be54c"
  },
  "anatomies": [
    {
      "id": "a",
      "axes": {"dataOwner": "parent", "repetition": "repeats", "weight": "populated", "composition": "label-value"},
      "citesPrecedent": "none",
      "states": ["populated", "empty", "pending"],
      "restingCount": 4,
      "parts": [
        {
          "name": "criterion-row",
          "cites": {"kind": "entry", "verdict": "generalize", "from": "flashcard-result-fact-row", "to": "fact-row", "callSites": 1, "why": "if you need a row comparing a name with one stored value on a shared baseline"},
          "whyMatch": "a name read against one stored value, repeated as rows on a shared baseline"
        }
      ],
      "reason": "why this anatomy is worth the owner's attention"
    }
  ]
}
```

Validate before writing and before hashing:

```bash
node @validate-artifact --schema @schema --data <batch.json> --hash
```

Beyond the shape, the validator refuses a class token anywhere in the batch, two anatomies sharing an axis
set, a `repeats` anatomy with no `restingCount`, and a batch where no anatomy cites `none`.

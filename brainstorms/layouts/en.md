---
title: Layouts
---

# Layouts

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@contract-search` | `scripts/contract-search.mjs` | script | resolve contract entries by their stated need |
| `@schema` | `brainstorms/layouts/schema.json` | file | validate the record's JSON shape |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |


## Record

You are given a business request in prose and you return **3–4 layout candidates**, each a JSON
structure the owner can choose between — or one refusal naming the product decision that is missing.
This is not a compiler: a compiler returns one answer because its law closes the choice. Here the
choice is a product decision, so returning one answer would be a compiler pretending the owner had
already decided.

## Law

A candidate names regions, who owns each region's geometry, what mounts once and what changes per
route. It never names a class. Classes are decided later, by law, from the shape this stage accepts;
a candidate that carries one has spent a decision that was not its to spend.

Every region cites something that exists: an entry in the contract, or an explicit statement that a
new entry is required and why. A region citing nothing is an invented component wearing a JSON
structure.

## Inputs

Seven, and no more. Each is here because something specific breaks without it.

| # | Input | Without it |
|---|---|---|
| 1 | The business request, verbatim | there is no intent, only a shape |
| 2 | The one evidence-backed direction recommended for the combined review | skeletons are compared under different visual intent |
| 3 | Contract: entry **key**, `why`, `host`, and children **names** | nothing can be looked up, so entries get invented |
| 4 | The branch inventory: every branch and what each may contain | a region has a shape and no assembler |
| 5 | The route table: every route page and every persistent layout | nothing separates what mounts once from what changes per route |
| 6 | The closed list of diversity axes | the 3–4 candidates differ by decoration, which is the same candidate four times |
| 7 | Precedents accepted for THIS project, the one the workspace route declared | every request is answered as if it were the first |

**Input 3 is queried, not read, and the class arrays are never extracted.** One need per region through
`@contract-search`, which returns `key`, `why` and `host`. The cut is not economy. A stage that
cannot see a class cannot write one into its output, so "no class in a candidate" holds because the value
never arrives — not because a reader was asked to skip a field. Measured on one 299-entry registry: 192KB
on disk, 69KB permitted, under 2KB actually answered.

Not read at this stage: class arrays, unselected theme choices, leaf and composite implementations, data and
queries, locale copy, lints. Those belong to the stages that come after.

## Reading a request

1. **List the surfaces the request states.** A request naming one page states one surface; a request
   naming a flow states several, and each gets its own batch.
2. **Look up before designing.** For every region, search the contract by `why`, and read `why` for what
   it is: **not a description of the business, but a statement of when you would reach for this entry.**
   Two entries with the same classes and different needs are different entries; two with different
   classes answering the same need are one entry that got written twice.
3. **Choose the axes each candidate will differ on**, from input 5. Two candidates sharing every axis
   value are one candidate.
4. **Assign an assembler per region** from the branch inventory. A region with an entry and no branch
   is unresolved, not finished.
5. **Place each region against the route table**: does it mount once and persist, change per route, or
   open as an overlay?
6. **Refuse rather than invent.** A decision the request does not state and the tree cannot derive is
   returned to the owner.

## Diversity axes

The closed set a candidate differs on. Each value is a structural fact, statable in one sentence.

| Axis | Values |
|---|---|
| navigation owner | navbar owns it / a rail owns it / no chrome |
| evidence against subject | beside the subject / below the subject |
| secondary region | its own route / a panel inside the page / an overlay |
| chrome | sticky / scrolls with content |

A candidate declares its axis values. Two candidates with an identical set are duplicates and one is
dropped — a machine can see that, so no reader has to.

## Per-region verdict

Every region resolves to exactly one of three, and the third is the exception:

| Verdict | When | Evidence owed |
|---|---|---|
| `reuse <key>` | an entry's `why` already answers this region's reason | none |
| `generalize <key> -> <key>` | an entry answers it but its name is bound to another feature | the call-site count of the old key, **and the rewritten `why`** |
| `new <key>` | no entry answers this reason | the `why` sentence the new entry will carry |

`generalize` without a measured call-site count is refused. A rename is cheap when one file cites the
key and product-wide when a shared branch does, and nothing in the contract distinguishes those two.

A generalized name must still fix its children. Widening `flashcard-result-fact-row` to `fact-row`
keeps a label and a value on one baseline; widening it to `row` names nothing and stops constraining
anything.

**A rename without a rewritten `why` is worse than no rename.** `why` is what a lookup matches on, so a
widened name carrying its old narrow reason promises a generality the index does not deliver: the next
reader searches by reason, finds nothing, and invents a third entry. Write the new reason as **the need
it answers** — "if you need a row comparing a name with one stored value on a shared baseline" — rather
than the feature it came from.

## Candidate laws

Twelve laws every candidate must satisfy. A candidate that breaks one is not a weaker option — it is not
a candidate, and shipping it as one of the 3–4 spends the owner's attention on something already refused.

| Code | Law | What it rejects |
|---|---|---|
| `LAYOUT-1` | An owner mounts once at the locale root only when it holds state the address cannot recompute — an open conversation, a live socket, a started session. Every other owner mounts in each route-group layout that needs it, and repeating it there is not a violation. | mounting once because an owner *feels* global or is always visible |
| `LAYOUT-2` | The global assistant and the faces of a page's content region are two axes running in parallel. The assistant owner receives the routed page as a component and seats it beside itself rather than wrapping it. | collapsing the two axes into one control with two values |
| `LAYOUT-3` | A page's section tabs are the second row of the navbar above them: they pin when it pins, take no space from it, and the reader sees exactly one divider under the finished stack at every scroll position. | a tab strip that floats at the top of the body |
| `LAYOUT-4` | A control that reaches a different page owner pushes a path; a control that changes which panel of the same owner is shown does not. When the panel choice must survive a reload and a pasted link, the owner reads it from a query. | routing a panel switch, or hiding a real page inside a tab |
| `LAYOUT-5` | A route that carries content has one real page owner, mounted by the route file and by nothing else. A route that is a door forwards, and forwarding is legal only because nothing becomes unreachable. | a content route with no owner, or with two |
| `LAYOUT-6` | An overlay's vendor boundary is already the bounded surface. Its content contract uses headings, rows, controls and spacing directly; mechanics bodies stay inset-free. | mounting a surface card inside an overlay boundary |
| `LAYOUT-7` | A modal names one width from the closed scale and records a reason about its content. Drawer and dropdown mechanics declare placement, not width. | inventing a width prop or a local class so mechanics resemble a modal |
| `LAYOUT-8` | A field is declared by exactly one region — the one whose own `why` asks the question that field answers. | two regions declaring the same field outside the two closed conditions |
| `LAYOUT-9` | A pinned region rests below the chrome of the page it stands on, measured from that page's own frame, and declares a height cap in the same decision as the offset. | an offset carried over from another page, or an offset with no cap |
| `LAYOUT-10` | A region's width is written by the contract composing the row it sits in, aimed at the child's identity rather than its position, taken from the closed class union, with every fixed measure paired against shrinking. | a region deciding its own width, or a width aimed at a sibling index |
| `LAYOUT-11` | This law returns a classification — full-width run or compact control — never a width. Both owner rulings on the same control stand. | picking one of the two rulings as a default |
| `LAYOUT-12` | Every business outcome becomes an explicit block brief before any component is designed: whether the block exists, whether this candidate uses it, what it renders, where it sits, which states it needs, and whether the registry is reused, extended or missing. | designing a component before the outcome has a brief |

## Rules

1. A candidate carries no class. Its only tokens or visual values are inside the same recommended `direction` object in every candidate.
2. Every region cites an entry key, or declares a new one with its `why`.
3. Every region names its assembling branch.
4. A candidate declares its axis values, and no two candidates in a batch share the whole set.
5. 3–4 candidates when the request admits more than one structure; fewer when it does not, with the
   reason stated. A batch is never padded to reach three.
6. A missing product decision is returned to the owner. It is never guessed to complete a batch.
7. A candidate's JSON is canonical — fixed key order, no timestamps, no per-run ids — because its hash
   is what the owner's approval attaches to.
8. Feedback opens a new round. An accepted candidate is never edited in place.

## Preview

The HTML view is a responsive web prototype with realistic representative content and illustration evidence,
not empty placeholder rectangles. Every layout region stays enclosed by a dashed boundary whose visible label
names the region, contract entry, assembler and mount lifetime. Preview-only interactions may demonstrate
navigation ownership, sticky behavior and responsive collapse; they do not become product behavior.

Content inside a region communicates density and reading order only. It cannot settle a block's parts, states,
data owner or final copy. Existing or legacy-backed imagery is preferred; a disposable inline SVG may stand in
when no reusable asset exists, and is never promoted into source or JSON. A blank-box page and an unannotated
polished mockup are both invalid previews.

## Refusal

Refusal is an output, not a failure. It is used when:

- the request states an outcome but not who owns a region's geometry;
- two regions claim the same field and the request does not say which owns it;
- a region requires an entry whose `why` contradicts the request;
- a required class does not exist in the contract's closed set — which makes it a **contract change**,
  not a layout choice.

```text
refusal: returned-to-owner
missing: <the decision nobody has made>
blocked: <which regions cannot be resolved without it>
```

## Output

The output **is** JSON, and its authority is `@schema` beside this record — not this
excerpt. `envelope` holds what varies between runs; the hash covers a candidate only, so the same
decision re-run in a later round produces the same hash.

```json
{
  "schema": 1,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "surface": "course-catalogue",
    "prompt": "the request, verbatim",
    "contractAt": "the contract state this was resolved against"
  },
  "candidates": [
    {
      "id": "a",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "navbar", "evidence": "beside", "secondary": "panel", "chrome": "sticky"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "results",
          "entry": {"verdict": "reuse", "key": "course-catalogue-card"},
          "assembler": "SurfaceListCard",
          "mount": "per-route",
          "whyMatch": "a course is read as one offer with its own entry action"
        }
      ],
      "reason": "why this candidate is worth the owner's attention"
    }
  ],
  "refusal": {"missing": "the decision nobody has made", "blocked": ["results"]}
}
```

Every object in the schema sets `additionalProperties: false`, so a `className` is not a finding to
argue about — it is invalid. Validate before writing and before hashing:

```bash
node @validate-artifact --schema @schema --data <batch.json> --vocabulary <visual-vocabulary.json> --hash
```

The validator also enforces the three batch laws no schema can state: no class token anywhere in the
batch, no two candidates sharing an axis set, and at least one candidate citing `none`.

## Worked example

**Request.** "A course catalogue: filters and the results, on one page."

The request states one surface and two regions. It does not state whether filters persist across
courses, so that is not assumed.

```json
{
  "schema": 1,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "surface": "course-catalogue",
    "prompt": "A course catalogue: filters and the results, on one page.",
    "contractAt": "5eb4ac6a2463"
  },
  "candidates": [
    {
      "id": "a",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "navbar", "evidence": "beside", "secondary": "panel", "chrome": "sticky"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "filters",
          "entry": {"verdict": "new", "key": "catalogue-filter-rail", "why": "a filter set names what the result region is currently showing"},
          "assembler": "SurfacePanel",
          "mount": "per-route",
          "whyMatch": "a filter set names what the result region is currently showing"
        },
        {
          "name": "results",
          "entry": {"verdict": "reuse", "key": "course-catalogue-card"},
          "assembler": "SurfaceListCard",
          "mount": "per-route",
          "whyMatch": "a course is read as one offer with its own entry action"
        }
      ],
      "reason": "filters beside results keeps the current narrowing visible while reading, which is what a catalogue is scanned for"
    },
    {
      "id": "b",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "rail", "evidence": "below", "secondary": "route", "chrome": "scrolls"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "scopes",
          "entry": {"verdict": "generalize", "from": "flashcard-mode-tabs", "to": "mode-tabs", "callSites": 2, "why": "if you need to switch between a small closed set of scopes rather than filter by them"},
          "assembler": "SurfaceCard",
          "mount": "mounts-once",
          "whyMatch": "a small closed set of scopes is switched between, not filtered by"
        }
      ],
      "reason": "if the real narrowing is a handful of scopes rather than many filters, a tab strip costs a fraction of the page a rail takes"
    }
  ],
  "refusal": {
    "missing": "whether a chosen filter set survives navigating into a course and back",
    "blocked": ["filters"]
  }
}
```

This exact batch validates, and its two candidates hash to `f5534ef5…` and `75056f73…`. Re-running it as
round 7 with a completely reworded prompt produces **the same two hashes**, because the envelope is
outside the hash. Without that property an approval would attach to a number that changes on its own.

The refusal ships **with** the candidates. Both remain readable; only the mount value is unresolved, and
saying so is more useful than picking one and being confidently wrong about it.

## Scope

This stage decides what a surface is made of and who assembles it. It does not decide a block's
anatomy, which is the next stage, and it does not decide a class, which is the law's business. The twelve
laws a candidate must satisfy are stated above as `LAYOUT-n` codes, so a candidate is checked against a
citable code rather than against a reader's memory of the legacy tree.

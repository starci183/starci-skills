# current module list bypasses surface owner

## Definition

This open bug records a disagreement between the binding block law, the Gate 2 schema and the live
StarCi Academy frontend. The `Current module` region is one named collection of comparable lesson
rows, so `B1-2` classifies it as exactly one `SurfaceListCard`. The live
`CourseLearnContentHomePage` instead renders the heading and repeated lesson contracts directly
inside the page `Tree`, with no surface-owner classification and no `SurfaceListCard`.

The defect is not the founder's classification. The law already gives the correct answer in
`fe/gates/blocks/laws/b1-one-surface-owner/INDEX.md`. The defect is that the law is not representable
or guaranteed in the current Gate 2 journey:

| Evidence | Finding |
|---|---|
| `fe/gates/blocks/laws/b1-one-surface-owner/INDEX.md:39` | `B1-2` maps a joined set of comparable rows under one name to exactly one `SurfaceListCard`. |
| `fe/gates/blocks/laws/b1-one-surface-owner/INDEX.md:145-146` | The law says its outputs feed `surface`, `isNested` and, when needed, `outerSurfaceOwner`. |
| `fe/gates/blocks/gate.schema.json:18-31` | `BlockCandidate` forbids additional properties but defines none of those surface fields. |
| `fe/gates/blocks/INDEX.md:13-14` | The block entry routes to the cardinality law but does not route the worker through the complete law set. |
| `skills/starci-fe-design-block/SKILL.md:8-11` | The worker reads the block entry, accepted layout, registry and intent, but is not explicitly required to classify every candidate under `B1`. |
| `starci-academy-fe/src/components/pages/CourseLearnContentHomePage/component.tsx:132-148` | The page emits the named lesson collection directly through `defineContractComponent` and `lessons.map`. |
| `starci-academy-fe/src/components/pages/CourseLearnContentHomePage/component.spec.tsx:39-49` | The focused test checks headings and navigation only; it does not assert a `SurfaceListCard` owner. |

## Rules

1. `CURRENT-MODULE-SURFACE-1` — Classify the current-module lesson collection as `B1-2`, because
   its lessons are comparable rows sharing one resolved module label and one navigation outcome.
2. `CURRENT-MODULE-SURFACE-2` — Gate 2 must carry the `B1` situation and surface decision in its
   validated candidate bytes, because a binding decision that the schema cannot represent cannot
   survive hashing, approval or execution.
3. `CURRENT-MODULE-SURFACE-3` — The Block worker must load and apply the complete applicable law
   set before emitting candidates, because routing only to the gate summary leaves unlinked laws
   dependent on model memory.
4. `CURRENT-MODULE-SURFACE-4` — Closing the frontend symptom requires one `SurfaceListCard` to own
   the module label and joined lesson rows; individual lessons remain rows and must not become
   separate cards.
5. `CURRENT-MODULE-SURFACE-5` — Closure requires both a gate regression and a focused component
   assertion, because repairing only the current page leaves the same schema hole available to the
   next named list.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Close the bug after only wrapping the current frontend rows | The immediate screenshot improves, but Gate 2 can still approve another named list without a surface owner. | Repair the schema/routing regression and then refactor the live region. |
| Close the bug after only restating `list -> SurfaceListCard` in prose | That law already exists; another copy does not make it enter candidate bytes or enforcement. | Add representable surface fields and validate the `B1` classification. |
| Reclassify the current module as `B1-3` without a declared bare host | A visually flat region is not evidence that the host contract owns a surface-less strip. | Keep `B1-2`, or first produce explicit accepted host evidence that changes the situation. |
| Give every lesson its own `SurfaceCard` | Separate boundaries falsely claim that peer lessons are independent objects. | Use one `SurfaceListCard` with divider-owned lesson rows. |
| Let the page `Tree` remain the implicit list owner | A layout contract arranges regions; it does not replace the named surface branch that owns a joined collection. | Mount the list through a block/branch with an explicit surface decision. |

## Examples

Wrong — the page contract silently becomes the list owner:

```tsx
module: defineContractComponent("course-content-current-module-path", {
    title: defineLeafComponent("heading", {}, renderTitle),
    lesson: lessons.map(renderLessonRow),
})
```

Right — one named branch owns the label and the joined rows:

```tsx
<SurfaceListCard
    contract="course-content-current-module-list"
    props={{ label: currentModule.title, lessons }}
    render={CurrentModuleLessonRows}
/>
```

Wrong — a Gate 2 candidate can say `collection.kind: "list"` while carrying no boundary decision:

```json
{
  "collection": { "kind": "list", "itemGrammar": "lesson row" },
  "ownership": { "owner": "CourseLearnContentHomePage", "split": "pure" }
}
```

Right — the approved bytes preserve the law's classification for execution:

```json
{
  "collection": { "kind": "list", "itemGrammar": "lesson row" },
  "surface": { "situation": "B1-2", "familyMember": "SurfaceListCard" },
  "isNested": false,
  "ownership": { "owner": "CurrentModuleLessonList", "split": "pure" }
}
```

The difference in both pairs is explicit ownership: a named joined list cannot pass Gate 2 or render
without the branch that owns its one shared surface.

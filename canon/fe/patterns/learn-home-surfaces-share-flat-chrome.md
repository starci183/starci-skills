# Every "home" in the Learn area shares one flat chrome — the content dashboard is the reference — STRICT

> Read from the redesign of the personal-project home against the content dashboard. Two pages doing
> the same job had invented two different chromes.

## The shape

Every home or overview page of a Learn surface — the content home, the personal-project home — uses
the same flat chrome. Not a style per page:

1. **Tier 1: breadcrumb.**
2. **Tier 2: header** — an H3 title, a description, and one row of meta or status chips.
3. **Tier 3: a flat continue-and-progress block** — an eyebrow, the name of the next piece of work
   in **semibold**, one primary "Continue" button, a `ProgressMeter` with `showValue`, and one muted
   stat line.
4. **The path — "Up next · \<current group\>"** — the list of items in the group the learner is
   currently in, as rows carrying a status icon (done, active, locked, todo), each opening its item.

No KPI card grid and no stat ribbon.

## The full list lives in the rail; the body says where you are and what is next

- Content: the rail is `ContentMap`, the module-to-lesson tree; the body is the path through the
  current module.
- Personal project: the rail is `MilestoneOutline`, milestone to task; the body is the path through
  the current milestone.

The body never redraws the whole tree — that is the same duplication the course-home rule forbids.

## Surface-specific data folds into the shared chrome

It does not get its own layout. The personal project's GitHub connection becomes **one status chip
in the header** — repo and branch when connected, "Chưa kết nối" when not — rather than a card of
its own. Secondary numbers (submission count, average score) join the **single muted stat line**
under the meter instead of forming a ribbon.

## Mirror the blocks and the rhythm

`ProgressMeter` and `ListRow`, with the same leading icons — active is Play in the accent colour on
a tint, done is CheckCircle in success, locked is Lock muted, todo is Circle muted — at `gap-3`
inside a region and `gap-6` between regions. The skeleton mirrors the same structure.

## The general form

When two pages hold the same role, pick one as the reference and mirror it. Letting each page invent
its own chrome means the set stops reading as a set.

## Related

`course-home-no-duplicate-surfaces.md` — the home does continue, progress and path, and nothing
already elsewhere · `surface-lands-on-dashboard-no-auto-forward.md` — the surface lands here rather
than skipping past it.

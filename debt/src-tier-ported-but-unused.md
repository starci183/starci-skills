---
title: src/components has an atom and frame tier that nothing in the app imports yet
role: fe
state: open
cost: large
opened: 2026-07-31
paths: [src/components/atoms, src/components/frames, src/components]
---

## What is wrong

61 files were copied from `.storybook/components/{atoms,frames}` into `src/components/{atoms,frames}`, minus the anatomy tooling. They compile and are complete, and not one of the app's 829 existing tsx files imports them. 714 of those files still reach for `@heroui/react` directly — 430 under `features/`, 219 under `blocks/`.

## Why it was left

The port was deliberately additive so it could not break anything: the two folders are new, so tsc could not move off its baseline whatever the copy contained. Rewiring 714 files is the opposite kind of change — user-visible, and impossible to verify by compilation alone. Splitting it here means the tier exists and can be reviewed before anything depends on it.

## What paying it looks like

Rewire by branch, vendor component by vendor component, starting where the blueprint already has an equivalent atom. The branches that survey cheapest are `drawers` (13 files) and `modals` (46); `features` at 430 is the one that needs a real plan rather than a sweep.

## Notes

The two trees are now copies and will drift. Whichever becomes the source of truth, the other needs a rule saying so — right now nothing states which one a change should land in first.

---
title: Chip has no width guard, so a long label is capped with max-w-40 at the call site
role: fe
state: open
cost: small
opened: 2026-07-31
rule: ATOM-5
paths: [.storybook/components/starci/blocks/learn/SubmissionFindingsList/SubmissionFindingsList.tsx, .storybook/components/atoms/chips/Chip]
---

## What is wrong

SubmissionFindingsList passes className="max-w-40 shrink-0" to Chip. The shrink-0 half is position and is fine; the max-w-40 half is a width the atom should own, because every Chip carrying a free-text label needs the same guard or it breaks its row.

## Why it was left

Deferred by decision, not by difficulty. It is unsettled whether the cap belongs to Chip as a prop or to the row that lays the chips out, and guessing would put a number in the wrong tier — which is the exact failure ATOM-5 exists to prevent. The other cases in this sweep had an obvious owner; this one does not.

## What paying it looks like

Decide the owner first. If it is the atom: a closed truncation prop on Chip, with the width measured inside the atom, and the call site keeps only shrink-0 in classNames. If it is the row: the cap moves to whatever frame lays the chips out, and Chip stays untouched.

## Notes

Two neighbouring cases were closed the other way and are NOT debt: Image w-28 and Typography w-32 are a fixed image size and a fixed label column, both legitimate fixed sizes owned by the layout.

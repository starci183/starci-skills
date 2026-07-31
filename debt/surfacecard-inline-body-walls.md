---
title: SurfaceCard inlines multi-line JSX into body instead of naming it
role: fe
state: open
cost: small
opened: 2026-07-31
rule: FRAME-9
paths: [.storybook/components/composites/cards/SurfaceCard/SurfaceCard.tsx]
---

## What is wrong

The migration from `children` to `body` hoisted 319 long bodies into named consts across the tree. SurfaceCard, at 2222 lines and eight card-family members, kept several as multi-line Fragments inlined straight into the prop — the skeleton-pressable branch runs about fifteen lines, and the stretched-link actions branch wraps content plus actions the same way.

## Why it was left

Not a rule violation and not new damage — the file was this dense before `body` existed, and nothing about it compiles differently. It was found because the closing agent was asked to read three files it had not written and say honestly whether the migration made them worse. It reported this one as the exception, which is worth more than the green gate beside it.

## What paying it looks like

A pass over this file alone, hoisting each long body to a const named for what it is on the screen. Read the two files the same agent judged good — ChallengePage and ContentHeader — for the shape to aim at.

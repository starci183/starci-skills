---
title: About fifty frame call sites still pass className, each blocked by a different question
role: fe
state: open
cost: medium
opened: 2026-07-31
rule: FRAME-4
paths: [.storybook/components/composites, .storybook/components/starci/blocks]
---

## What is wrong

FRAME-4 is green at the definitions — all nine frames take `classNames: Array<AllowedClassName>` — but roughly fifty call sites could not move. They fall into five groups: a composite forwarding its own opaque `className` (~25); padding written as a class (`px-3`, `py-2`, `pt-1`, `p-3`, `my-2`); responsive visibility and direction (`hidden @app-md:flex`, `flex-col @app-md:flex-row`); appearance (`rounded-3xl bg-surface`, `opacity-50`, a pseudo-element rule); and fixed sizes (`w-24`, `h-16`, `max-w-sm`, `max-h-[420px]`).

## Why it was left

Widening the union to absorb them would end the union: the moment one arbitrary form is allowed, every hand-measured number arrives through it. Each group is a real decision instead — and three of them are the same decisions already recorded against the atom tier, which is where they should be settled once rather than twice.

## What paying it looks like

The padding group is not a decision and can be fixed now: every frame already takes `padding: InsetScale`, so those callers are simply not using a prop that exists. The forwarding group follows whatever the atom-tier forwards settle on. Responsive visibility is already recorded separately. Appearance and fixed size need the same treatment as their atom equivalents.

## Notes

Related: [[no-responsive-visibility-in-allowed-classname]], [[no-margin-in-allowed-classname]], [[surfacecard-forwards-title-classname]].

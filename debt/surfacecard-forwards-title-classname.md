---
title: SurfaceCard forwards an opaque titleClassName into Typography
role: fe
state: open
cost: small
opened: 2026-07-31
rule: ATOM-5
paths: [.storybook/components/composites/cards/SurfaceCard/SurfaceCard.tsx, .storybook/components/composites/layout/DrawerShell/DrawerShell.tsx, .storybook/components/composites/layout/ModalShell/ModalShell.tsx]
---

## What is wrong

SurfaceCard declares titleClassName?: string and hands it straight to the title Typography at line 1408. DrawerShell and ModalShell both re-forward it, so three components carry the same unconstrained string.

## Why it was left

Left out of the call-site sweep because it was not on the list that sweep was scoped to, and it is a three-file cascade rather than a single edit. Recorded rather than widened into a job that was already running.

## What paying it looks like

Read what callers actually pass. If it is appearance, it is a Typography prop the title should name; if it is position, narrow all three to Array<AllowedClassName> the way InlineIconLabel was.

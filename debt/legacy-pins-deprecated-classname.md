---
title: Two _legacy callers keep EnumChip deprecated className alive
role: fe
state: open
cost: small
opened: 2026-07-31
rule: ATOM-5-type
blocked_by: Deleting _legacy
paths: [.storybook/components/composites/chips/EnumChip/EnumChip.tsx]
---

## What is wrong

EnumChip now forwards classNames but kept className as well: HostPlatformChip and EntityResultRow, both under _legacy/, still pass a free string and are off-limits to edit. Removing className outright put two new errors on the board. VariantChip, which had no legacy caller, dropped className cleanly — that is the shape this should end in.

## Why it was left

The blocker is not the composite, it is that _legacy is still compiled. Editing files there to unblock a rule they are exempt from would spend work on code meant to be deleted.

## What paying it looks like

Nothing to do here. When _legacy goes, delete className from EnumChip and it matches VariantChip.

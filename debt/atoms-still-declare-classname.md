---
title: Atoms still declare the deprecated className, because six forwards have nowhere to land
role: fe
state: open
cost: large
opened: 2026-07-31
rule: ATOM-5-type
paths: [.storybook/components/atoms]
---

## What is wrong

All 32 atom prop types still carry `className?: string` beside the new `classNames?: Array<AllowedClassName>`, and the audit gate ATOM-5-type reports every one. ATOM-3, ATOM-4 and ATOM-5 itself are green — the escape hatch is declared but nearly unused.

## Why it was left

Deleting the prop is one edit per atom and cannot be done yet: six call sites still pass a string the closed union has no member for, and each is blocked on a different unanswered question. Cutting className while they exist would only push those strings into a cast, which is worse than leaving the door labelled.

## What paying it looks like

Settle the six blockers, then delete className from all 32 atoms in one sweep and let ATOM-5-type go green. The gate already lists them, so the sweep is mechanical once the questions are answered.

## Notes

Blockers: button-status-tone · no-margin-in-allowed-classname · no-responsive-visibility-in-allowed-classname · container-floor-above-readable-caps · legacy-pins-deprecated-classname · surfacecard-forwards-title-classname · chip-width-guard.

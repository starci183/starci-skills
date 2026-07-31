---
title: AllowedClassName excludes margins by design, but a callout documents margins as its only use
role: fe
state: open
cost: medium
opened: 2026-07-31
rule: ATOM-5
paths: [.storybook/components/atoms/_allowed-class-name.ts, .storybook/components/composites/feedback/Feedback/Feedback.tsx]
---

## What is wrong

FeedbackCallout, TaskLockedAlert and Alert all document their className as placement utilities only, giving mb-4 as the example. AllowedClassName deliberately has no margin member — its own header says space between children belongs to the frame gap. So the forward at Feedback.tsx:149 cannot be narrowed the way InlineIconLabel was: narrowing would forbid the one documented use rather than legalise it.

## Why it was left

Two rules of the house point opposite ways and neither is obviously wrong. Minting a margin union to resolve it touches the shared union plus three tiers of JSDoc, which is a canon change and not something to slip into a call-site sweep.

## What paying it looks like

Decide which rule wins. Either the callers are wrong and the surrounding frame should own that spacing through gap, in which case the JSDoc is what to fix; or margins get a small closed union of their own, kept separate from AllowedClassName so the two never blur.

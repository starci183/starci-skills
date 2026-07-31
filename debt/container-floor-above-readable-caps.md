---
title: The Container scale has no step narrow enough for the two readable caps that need a home
role: fe
state: open
cost: small
opened: 2026-07-31
rule: ATOM-5
paths: [.storybook/components/starci/blocks/learn/EnrollGate/EnrollGate.tsx, .storybook/components/frames/Container]
---

## What is wrong

EnrollGate caps a paragraph at max-w-[400px] and a CTA at max-w-[300px], both through className on an atom. A readable width cap belongs to Container, but the smallest Container step is 640px, so wrapping either would be a no-op. Both already sit inside a 480px SurfaceCard.

## Why it was left

The right fix is a Container step below 640px, and inventing one to fit a single screen is how a scale turns into a list of one-offs. It needs a look at every narrow measure in the system at once, not at this screen alone.

## What paying it looks like

Survey the narrow measures across the blocks, then either add the steps that survey justifies, or accept that a CTA width cap is not a page measure and give Button a width prop instead.

---
title: wrap on StackH and Flex changes shape without naming a width
role: fe
state: open
cost: small
opened: 2026-07-31
rule: FRAME-10
blocked_by: A decision on the two call sites that genuinely reflow
paths: [.storybook/components/frames/Stack/Stack.tsx, .storybook/components/frames/Flex/Flex.tsx, .storybook/components/starci/blocks/navigation/Footer/Footer.tsx]
---

## What is wrong

The last two FRAME-10 violations. A boolean says THAT the shape changes and refuses to say where, so it fires wherever the content happens to overflow — which depends on the string, the translation and the font. Four call sites use it. Two of them (Footer, twice) already carry an explicit breakpoint in a class string right beside `wrap`, so the real threshold is named and `wrap` is vestigial. The other two are a price-block plus CTA, and a label plus chip.

## Why it was left

The Cluster hypothesis was tested and failed: none of the four is a uniform repeating list, so converting them would be wrong. That leaves two different answers for two different pairs of call sites — delete the redundant ones, and decide separately whether the remaining two get a named threshold or stay as they are. Neither answer follows from the rule alone.

## What paying it looks like

Delete `wrap` at the two Footer sites, where a breakpoint class already does the work. For the other two, either give StackH a named threshold prop in the shape of `ResponsiveRow.at`, or accept that a two-element reflow is not a breakpoint and drop the rule's claim over it.

## Notes

TrialConversionStrip carries an inline comment recording that `Split` was tried here and measured wrong — the left side squeezed to 216px. Read it before proposing Split again.

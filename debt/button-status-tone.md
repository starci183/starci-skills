---
title: Button has no status colour axis, so two tables of class strings survive
role: fe
state: open
cost: medium
opened: 2026-07-31
rule: ATOM-5
blocked_by: A decision on whether Button gains a six-value status tone, or whether these two callers are asking for something Button should not support
paths: [.storybook/components/atoms/feedback/Alert/Alert.tsx, .storybook/components/composites/feedback/Feedback/Feedback.tsx, .storybook/components/atoms/buttons/Button]
---

## What is wrong

Alert keeps STATUS_CLOSE_TONE and Feedback keeps CALLOUT_ACTION_CLASS — both six-way tables mapping an alert status to a Button class string, handed in through className. Button's only colour axis is variant, and no variant reproduces either shape: STATUS_CLOSE_TONE is transparent until hover then a soft tint, which neither ghost nor danger-soft does. Of the twelve entries across both tables, exactly one (CALLOUT_ACTION_CLASS.danger) equals an existing variant.

## Why it was left

The fix is a new prop on Button covering the same six statuses, and that is a design decision rather than a mechanical one: it adds a second colour axis beside variant, and two axes that can disagree is how a component API starts to rot. Converting only the one matching entry was rejected — it splits one table into two inconsistent paths and buys nothing.

## What paying it looks like

Either give Button a status tone covering the six values with ghost-until-hover behaviour and delete both tables, or decide the close button and the callout action are not Buttons at all.

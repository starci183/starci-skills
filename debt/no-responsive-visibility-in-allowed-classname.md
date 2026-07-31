---
title: A responsive visibility toggle has no legal path, so one composite keeps className
role: fe
state: open
cost: small
opened: 2026-07-31
rule: ATOM-5
paths: [.storybook/components/starci/blocks/learn/LeaderboardCategoryNav/LeaderboardCategoryNav.tsx, .storybook/components/starci/pages/LeaderboardPage/LeaderboardPage.tsx]
---

## What is wrong

LeaderboardPage passes className="@app-lg:hidden" to LeaderboardCategoryNav, which forwards it into ButtonRadioGroup. The composite gained classNames and forwards that too, but className had to stay for this one caller: @app-lg:hidden is breakpoint visibility, and AllowedClassName covers only flex and grid placement, fractional widths, span and order.

## Why it was left

Whether a thing is shown at a breakpoint is arguably position — it is a fact about the parent layout, which is the exact test AllowedClassName uses. It is also the first non-placement class anyone has asked to let through, and widening a closed union is how closed unions stop meaning anything. Worth a deliberate answer rather than a reflex.

## What paying it looks like

Either add a small set of breakpoint visibility members to the union, or give the composite a prop naming the intent, or let the page hide it with a wrapper it already owns.

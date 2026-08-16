---
title: New FE has no write-feedback lane (no toast, no runGraphQL)
role: fe
state: open
cost: medium
opened: 2026-08-10
paths: [starci-academy-fe/src/components/blocks/auth/AuthenticationPanel/component.tsx]
---

## What is wrong

New FE has no write-feedback lane (no toast, no runGraphQL)

## Why it was left

grep for 'toast' across starci-academy-fe/src returns 0 hits, yet the app already ships writes (mutation-sign-in-init, forgot-password-*, exchange-code-for-token) and the dashboard's DailyQuest reward claim is coming. The legacy app answers this with useGraphQLWithToast -> runGraphQL (src/modules/toast/hooks.ts:33), used by 51 files, reserved for writes: reads stay plain SWR because SWR revalidates in the background and toasting every failed revalidation would spam. The new FE currently substitutes an in-panel statusMessage/isError pair owned by AuthenticationPanel, which works for a standalone form but has nowhere to render for a button sitting mid-dashboard. Decide before the first dashboard write lands: port the toast lane, or write down the rule that write status renders in place. Leaving it undecided means each block invents its own, which is the escape-hatch failure contract.md exists to prevent, one tier up.

## What paying it looks like

_Not worked out yet._

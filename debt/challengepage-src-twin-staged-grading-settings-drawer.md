---
title: ChallengePage src twin staged; grading-settings drawer deferred
role: fe
state: open
cost: medium
opened: 2026-08-03
rule: src-tier-ported-but-unused
---

## What is wrong

ChallengePage src twin staged; grading-settings drawer deferred

## Why it was left

Batch-17 twin: component.tsx mirrors the storybook ChallengePage; index.tsx lifts the v1 wiring (redux challenge.entity/completionTasks/config, useEditSubmissionForm URL edits, submit mutation + job-notification socket subscription, per-row socket job status, i18n section resolution). But it is STAGED: the route .../challenges/[challengeId]/page.tsx still renders the v1 src/components/features/learn/Challenge/ChallengePage, and nothing imports the twin. Two pieces are intentionally NOT ported because the storybook screen folds them into a grading-settings drawer that this pass does not build (onOpenGradingSettings is a chrome trigger only): the programming-language SELECTOR (so twin content resolves at the default active language rather than a learner-picked one) and the private-repo GitHub token field (useMutateSyncPersonalProjectGithubSwr). Also dropped, matching the storybook props: grade-model/provider selection, AI quota/premium gating, and the autosave status line (ChallengePageProps omits autosaveStatus). Route swap + drawer deferred until this twin is actually mounted.

## What paying it looks like

_Not worked out yet._

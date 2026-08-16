---
title: PersonalProjectWorkspace src twin staged; settings/attempts drawers deferred
role: fe
state: open
cost: medium
opened: 2026-08-03
rule: src-tier-ported-but-unused
paths: [src/components/page/PersonalProjectWorkspace]
---

## What is wrong

PersonalProjectWorkspace src twin staged; settings/attempts drawers deferred

## Why it was left

Batch-17 twin: component.tsx mirrors the storybook PersonalProjectWorkspace (3-leaf view switch — dashboard/task/result); index.tsx dispatches on URL (taskId + /result) and lifts the v1 wiring from src/components/features/learn/PersonalProject (PersonalProjectDashboard milestones+progress+enrollment-github; Task reading column brief/legacy-criteria/legacy-code + related RAG search; TaskSubmissionPanel github form store + TaskActions evaluate gating + latest graded result; TaskResult attempts/feedbacks/model-byline/next-task-handoff). But it is STAGED: the live route src/app/[locale]/courses/[courseId]/learn/personal-project/layout.tsx (and .../tasks/[taskId]/result/page.tsx) still render the v1 src/components/features/learn/PersonalProject/PersonalProjectWorkspace; nothing imports the twin. Three chrome surfaces are intentionally NOT ported because the storybook PersonalProjectTaskPage folds them away and does not build them: the grading-settings drawer (GithubGradingSettings — onOpenSettings is a chrome-only no-op, so grade-model/provider selection + private-repo token + branch/lang editing are unreachable), the attempts-history drawer (onOpenAttempts is a no-op; the result view shows all attempts inline with no +N overflow), and the v1 AIProcessingText job-status line (no presentational surface — only isEvaluatePending is surfaced). Route swap + drawers deferred until the twin is actually mounted.

## What paying it looks like

_Not worked out yet._

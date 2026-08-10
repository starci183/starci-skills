---
title: Canon testing.md cites an e2e spec that no longer exists
role: be
state: open
cost: small
opened: 2026-08-10
paths: [.claude/canon/be/enforce/authoring/testing.md]
---

## What is wrong

Canon testing.md cites an e2e spec that no longer exists

## Why it was left

testing.md line 129 anchors the AiInvokeService provider-swap example to src/tests/e2e/ai-lab-eval-runner.e2e-spec.ts, which is not in the source. The two specs that actually stub AiInvokeService today are src/tests/e2e/content-ai-session.e2e-spec.ts and content-ai-entitlement.e2e-spec.ts. Repointing the anchor was proposed and the teacher declined it in-session, so the sentence is left exactly as written rather than re-aimed at a spec that may not make the same point. verify.mjs be reports this as its one remaining dead anchor (47 checked, 1 failed).

## What paying it looks like

_Not worked out yet._

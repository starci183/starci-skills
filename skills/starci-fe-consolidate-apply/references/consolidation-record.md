# Consolidation record interface

Write matching `consolidation-record.md/json` beside the applied work. Version 1 is required, and
the JSON is what
[`../scripts/verify_consolidation_record.mjs`](../scripts/verify_consolidation_record.mjs) checks.
The verdicts themselves live in the inherited
[survey](../../starci-fe-consolidate-plan/references/consolidation-plan.md) and are not restated
here.

```json
{
  "version": 1,
  "task": "two streak cards became one",
  "contextLock": "absolute context-lock.consolidate-apply.json path",
  "planRecord": "absolute consolidation-plan.json path",
  "writeBoundary": {
    "confirmed": true,
    "confirmationEvidence": "the user's own words confirming repo, branch, worktree and files"
  },
  "clusters": [
    {
      "clusterId": "streak-card",
      "callSites": ["src/app/dashboard/page.tsx", "src/app/profile/page.tsx"],
      "supersededRemoved": true,
      "parity": [
        {
          "callSite": "src/app/dashboard/page.tsx",
          "stateId": "dashboard-owner-populated-desktop-light-en",
          "identical": true,
          "before": { "path": "before-0.png", "sha256": "filled by seal command" },
          "after": { "path": "after-0.png", "sha256": "filled by seal command" }
        }
      ]
    }
  ]
}
```

## What this record is for

It answers one question: **did the approved survey happen, and did anything move that should not
have?** Three facts carry that.

`planRecord` names the survey being carried out, and the verifier reads it. A cluster absent from
the survey was invented while somebody was in the files; a cluster the survey marked `keep-apart`
was overruled by the phase least entitled to overrule it. Both block the seal.

`callSites` must match the survey's measured list exactly. Widening it is scope creep discovered too
late to review — the new call site was never compared, ranked or approved. Narrowing it is a caller
left pointing at an owner that is about to be deleted. Neither is a judgement call, which is why
neither is left to one.

`parity` states, for each measured call site and one named state, that it rendered the same thing on
both sides. It is recorded rather than inferred because tests cannot assert it: no unit test knows
what a screen looked like yesterday, so a merge that restyles one caller passes all of them. Renders
are hashed, so a screenshot retaken after the fact stops being evidence.

`supersededRemoved` is a claim that the losing owner and its story are gone. An orphan left behind
is a second word for the thing that now has one word, and the next survey will find it, rank it, and
spend the same effort again.

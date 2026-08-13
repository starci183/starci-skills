# Consolidation survey interface

Write matching `consolidation-plan.md/json` without secrets or copied production data. Version 1 is
required, and the JSON is what
[`../scripts/verify_consolidation_plan.mjs`](../scripts/verify_consolidation_plan.mjs) checks.

```json
{
  "version": 1,
  "task": "two streak cards look alike",
  "contextLock": "absolute context-lock.consolidate-plan.json path",
  "scope": "src/components/blocks/dashboard",
  "status": "verdicts-proposed | verdicts-approved",
  "approvalKind": "explicit | default-after-ambiguity",
  "approvalEvidence": "the user's own words",
  "defaultReason": null,
  "clusters": [
    {
      "clusterId": "streak-card",
      "verdict": "merge | prop-variant | extract-composite | keep-apart",
      "members": [
        { "path": "src/components/blocks/dashboard/StreakCard/component.tsx", "tier": "block" },
        { "path": "src/components/blocks/profile/StreakSummary/component.tsx", "tier": "block" }
      ],
      "callSites": ["src/app/dashboard/page.tsx", "src/app/profile/page.tsx"],
      "canonicalTarget": "the one owner that survives",
      "reason": "required only for keep-apart",
      "propDelta": { "added": [{ "name": "tone", "absence": "defaults to neutral" }] }
    }
  ]
}
```

## Why call sites are frozen here and not in Apply

`callSites` is a measurement of a tree that is about to change. Taken afterwards it can only confirm
what the diff already did, and the failure this lane produces — a caller nobody updated — is
invisible in a list built from the finished work. Apply inherits this list and may neither widen nor
narrow it, which is what turns a forgotten caller into a blocked handoff rather than a bug report
next week.

## Why each verdict carries a different burden

`keep-apart` needs a `reason` and nothing else. A pair compared and deliberately left alone is a
finding: it stops the next survey spending the same effort to reach the same answer.

`prop-variant` may add exactly one prop, and that prop must state its absence or default. One named
variant is a variant; a boolean per call site means these were two components and the survey found a
coincidence. No added prop may be `className`, `style` or another appearance hook, because
[`SLOTS-6`](../../../fe/canon/patterns/props-and-slots.md) refuses the appearance slot outright.

`extract-composite` needs at least three call sites. Two is an anchor to two files; three is a
pattern — a new owner is not earned by a coincidence that happened twice. This is the verdict for
the case that looks hardest: two blocks over two different domain entities that render identically
are not one block, they are two blocks with a
[`composite`](../../../fe/canon/uxui/layers/composite.md) hiding inside them.

`merge` needs only two members and a canonical target, because merging two owners that already exist
removes a word rather than inventing one.

## Why a default may only leave things alone

A ranking is not an instruction. When approval stays ambiguous after one re-ask, the clusters in
doubt default to `keep-apart` — never to merging them — because a cluster left alone remains
available tomorrow while a wrong merge has to be unpicked from every call site it touched. The
verifier refuses a `default-after-ambiguity` that would still edit something, and
`approvalEvidence` stays for words a user actually said.

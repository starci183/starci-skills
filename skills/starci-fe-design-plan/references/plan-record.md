# Plan record interface

Write matching `plan-record.md/json` without secrets or copied production data.

```json
{
  "version": 2,
  "task": "stable name",
  "status": "direction-selected",
  "contextLock": "absolute context-lock.plan.json path",
  "caseId": "case-dashboard-system",
  "deliveryMode": "single | batch",
  "mode": "migration | creative | mixed",
  "renderStatus": "directional-not-apply-baseline",
  "parityBaseline": null,
  "workItems": [],
  "evidence": [],
  "unknowns": [],
  "businessCapabilities": [],
  "directions": [
    {
      "directionId": "direction-a",
      "posture": "parity-first | conservative | balanced | bold",
      "thesis": "",
      "primaryCta": "",
      "readingOrder": [],
      "tradeoffs": [],
      "legacyDivergence": [],
      "implementationFeasibility": {
        "status": "mapped",
        "existingOwners": [],
        "existingContracts": [],
        "exactProposals": [],
        "unmappedAnatomy": []
      },
      "representativeSceneId": "direction-a-default"
    }
  ],
  "stateManifest": [],
  "directionLab": {
    "path": "artifact path",
    "url": "http://127.0.0.1:8080/",
    "caseId": "case-dashboard-system",
    "directionIds": []
  },
  "selectedDirectionId": "direction-a",
  "selectionKind": "explicit | default-after-ambiguity",
  "selectionEvidence": "explicit user words",
  "defaultReason": null,
  "blockTrees": [],
  "contracts": [],
  "vocabularyProposals": [],
  "backendEnablerProposals": []
}
```

Arrays remain present when empty. One run has one `caseId`; two to four directions are alternatives
inside it. `selectedDirectionId` is set only after explicit choice. A hybrid becomes one updated
direction with refreshed HTML. Plan has no approved revision; Preview owns revision approval.
`renderStatus` is invariant. `implementationFeasibility.status` may be `mapped` only when
`unmappedAnatomy` is empty and every exact proposal names its future owner, path and API. Plan HTML
is never copied into production or treated as a visual parity baseline.

API proposals record target/path, reusable semantic meaning, exact `props`/`on` delta, placement,
absence/default, precedence, callers, compatibility and tests. Backend proposals record UI need,
classification, operation, evidence, authorization, compatibility, tests and escalation trigger.

## Posture, and what happens when nobody chooses

`posture` names how much a direction risks: `parity-first` preserves the named reference,
`conservative` minimizes change, `balanced` makes one strong product bet, `bold` reorganizes around
the page thesis. It is recorded because the most common answer to "which of these?" is not one of
them. It is "either is fine", "whichever is fastest", or nothing at all, and a procedure with no
rule for that hands the decision back to the run — which is the failure the stop-for-selection step
exists to prevent.

So a default is allowed, and it is never allowed to be recorded as a selection. Ask once more as a
binary question. If the answer stays ambiguous, fall to the direction that risks least — the
`parity-first` one wherever a `parityBaseline` exists, otherwise the `conservative` one — set
`selectionKind` to `default-after-ambiguity`, and write in `defaultReason` what was asked and what
came back. `selectionEvidence` stays for words a user actually said; a default has none, and
borrowing the field would make the record claim a decision nobody made.

## Verification

```powershell
node <trust-root>/skills/starci-fe-design-plan/scripts/verify_plan_record.mjs <plan-record.json>
```

The verifier holds only what a machine can hold: version and mode vocabulary, the invariant
`renderStatus`, two to four uniquely named directions, every array present, a lab scene per
direction, feasibility that does not claim `mapped` while naming unmapped anatomy, a parity baseline
and a parity-first direction in migration and mixed work, and a selection that records either the
user's words or an honest default. Whether two directions are materially DIFFERENT stays a judgement
no script can take — which is exactly why the rest is checked rather than trusted.

# Fidelity record interface

Write matching `fidelity-record.md/json` without secrets or copied production data. Version 1 is
required, and the JSON is what
[`../scripts/verify_fidelity_record.mjs`](../scripts/verify_fidelity_record.mjs) checks.

```json
{
  "version": 1,
  "task": "restore the activity row divider",
  "contextLock": "absolute context-lock.fidelity.json path",
  "owner": "block-activity-feed",
  "files": ["src/components/blocks/feed/ActivityFeed/component.tsx"],
  "bindingEvidence": {
    "kind": "instruction | legacy-source | approved-revision | contract-why | test",
    "source": "where the expected result is already proven"
  },
  "writeBoundary": {
    "confirmed": true,
    "confirmationEvidence": "the user's own words confirming repo, branch, worktree and files"
  },
  "intendedCorrection": "the smallest change that restores the evidenced result",
  "canonProposal": null,
  "unknowns": [],
  "commands": [],
  "touchedStates": [
    {
      "stateId": "activity-populated-desktop-light-en",
      "ownerId": "block-activity-feed",
      "before": {
        "commit": "reference commit",
        "route": "/dashboard",
        "viewport": { "width": 1440, "height": 1000, "dpr": 1 },
        "locale": "en",
        "theme": "light",
        "authPersona": "owner",
        "ownerState": "populated",
        "fixtureSha256": "fixture or backend seed hash",
        "render": { "path": "before.png", "sha256": "filled by seal command" }
      },
      "after": { "commit": "target commit", "…": "every field above, identical except commit" }
    }
  ]
}
```

## The one rule this record exists to hold

`before` and `after` must agree on route, viewport, locale, theme, auth persona, owner state and
fixture hash. The only field allowed to differ is `commit`.

It is checked rather than asked for, because the failure it prevents is invisible at review. An
owner render beside a visitor render, a seeded list beside an empty one, light beside dark: each
produces a pair that looks comparable and proves nothing, and the run reports a defect fixed that
was never measured. When the two sides disagree the comparison is `invalid` — not `pass`, not
`fail`, and never "an expected state difference". Capture the matching state, or stop.

## The rest, and why each field is there

Arrays stay present when empty. One record holds one owner and every touched state names that same
owner, because ownership expansion is a product decision and this lane has none — it routes to Plan.

`bindingEvidence` names where the expected result was proven BEFORE this run started. A repair whose
only evidence is the run's own judgement is a design decision wearing a repair's clothes, and the
enumerated kinds are there so that "it looked wrong" cannot be typed into the field.

`writeBoundary.confirmed` is a recorded fact rather than an assumption, because a small fix changes
the amount of code and not the authority required to change it. `canonProposal` stays null unless
the user authorized that separate write boundary; one visual preference is not canon.

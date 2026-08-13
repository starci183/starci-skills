# Approved executable design record

Write matching `design-record.md/json` beside the executable candidate. Version 3 is required.

```json
{
  "version": 3,
  "task": "stable name",
  "planRecord": "absolute plan-record path",
  "contextLock": "absolute context-lock.preview.json path",
  "caseId": "case-dashboard-system",
  "selectedDirectionId": "direction-a",
  "approvedRevision": "1.3",
  "revisionHistory": [],
  "deliveryMode": "single | batch",
  "mode": "migration | creative | mixed",
  "parityBaseline": null,
  "workItems": [],
  "evidence": [],
  "unknowns": [],
  "decisions": [],
  "candidate": {
    "root": "absolute candidate root",
    "framework": "same production framework",
    "buildCommand": "command that passed",
    "build": {
      "command": "npm run typecheck",
      "exitCode": 0,
      "log": { "path": "build.log", "sha256": "filled by seal command" }
    },
    "files": [
      {
        "path": "src/candidate.tsx",
        "targetPath": "src/components/.../component.tsx",
        "sha256": "filled by seal command"
      }
    ]
  },
  "states": [
    {
      "stateId": "profile-owner-populated-desktop-light-en",
      "ownerId": "page-profile",
      "route": "/profile/test",
      "viewport": { "width": 1440, "height": 1000, "dpr": 1 },
      "locale": "en",
      "theme": "light",
      "authPersona": "owner",
      "fixture": { "path": "fixtures/owner.json", "sha256": "filled by seal command" },
      "screenshot": { "path": "screens/owner.png", "sha256": "filled by seal command" },
      "coverage": "rendered",
      "componentTree": [],
      "contracts": [],
      "props": [],
      "tokens": []
    }
  ],
  "integrationEdits": [
    { "targetPath": "src/components/.../component.tsx", "reason": "wire the app env import" }
  ],
  "stateCoverage": [],
  "blockTrees": [],
  "contracts": [],
  "vocabularyProposals": [],
  "backendEnablerProposals": [],
  "preview": {
    "path": "absolute preview directory",
    "url": "http://127.0.0.1:8080",
    "caseId": "case-dashboard-system",
    "revision": "1.3"
  },
  "approval": {
    "kind": "explicit | confirmed-restated",
    "restatement": null,
    "source": "explicit user words naming revision 1.3"
  },
  "seal": { "algorithm": "sha256", "manifestSha256": "filled by seal command" }
}
```

Every `rendered` state needs exact runtime identity, fixture, screenshot, component tree, contracts,
props and tokens. Arrays remain present when empty. Candidate files name exact production target
paths and must live under `candidate.root`; a record cannot bless production source or another
artifact by pointing outside that root. State IDs and target paths are unique. `approvedRevision`
must equal the running revision named by the user. Seal only after
approval; any artifact or semantic-record change requires a new revision and approval.

## What the record keeps separate, and why

The schema above is shaped by four judgements. They are stated here because a field list tells an
implementer what to fill in and never tells them what the field is protecting.

**One living record per case, not three documents.** Research notes, a concept write-up and a
handoff summary drift the moment any one of them is updated alone, and the reader cannot tell which
is current. Update this record as evidence changes rather than producing a companion to it.

**`evidence`, `unknowns` and `decisions` are three collections because they carry three different
authorities.** Evidence has a source that can be reopened. An unknown is a reversible guess. A
decision states a tradeoff that was accepted. Merged into one list, an assumption quietly acquires
the standing of code or of a user instruction, and the next reader has no way to tell which claims
were checked.

**`revisionHistory` keeps rejected traits and the reason they lost.** One sentence per rejection is
enough. Its purpose is to stop the same alternative returning without new evidence — not to preserve
the debate, which belongs to the conversation rather than to the record.

**A `rendered` state is one that was observed, never one that was expected.** "Verified" without a
named scope is not evidence, which is why every rendered state carries its own route, viewport,
locale, theme, persona, fixture hash and screenshot, and why states that were reasoned about rather
than observed stay in `stateCoverage` as `covered-by` or `not-applicable`. A reviewer must be able
to separate proof from expectation without asking.

## Three claims the verifier will not take on trust

**The build ran.** `candidate.build` records the command, its exit code and a hashed log, because
the claim that separates a candidate from a picture is that it EXECUTES, and a command named in a
field proves nothing about a command anybody ran. A non-zero exit code blocks the seal, and the log
is hashed with everything else so a later "it built at the time" cannot be asserted after the fact.

**Nothing was skipped in silence.** `stateCoverage` must classify at least one state per owner that
renders anything, a `rendered` or `covered-by` entry must name a scenario that a sealed state
actually provides, and `not-applicable` must carry the reason the state cannot occur. Omission has
no field of its own, which is exactly what makes it invisible: four convincing states look the same
whether the fifth was ruled out or never considered.

**Any difference Apply is allowed to introduce is named here, before the seal.** A candidate cannot
always land byte-identical — an env import, a path alias, a provider the artifact stubbed. Each such
file goes in `integrationEdits` with its reason while the record is still being approved, because a
permission granted after sealing is not a permission, it is an exception written by the party it
excuses. If Apply meets a needed edit that nobody declared, that is a return to Preview and a new
minor revision, not a note in the commit message. Apply's materialization gate reads exactly this
list: an undeclared difference is reported as a substitution and blocks handoff.

**Somebody approved this exact revision.** `approvedRevision` must appear in `revisionHistory` and
must equal `preview.revision`, so the approved thing and the running thing are one thing. Approval
comes in two honest shapes. `explicit` means the user's own words name the revision. But the common
answer is "ok" or "looks good" after several revisions exist, which approves a specific thing only
if that thing was named back first — so `confirmed-restated` stores the restatement that carries the
revision and the user's bare words separately, and neither may stand in for the other. Silence
remains not an approval in either shape.

# The UAT flow folder

This directory is the template a flow folder is created from, and this file is the contract that
folder is held to. `uat.verify` reads the shape, `identity.provision` and `data.seed` provision what is missing, and
both validators refuse a folder that has drifted from it. Nothing here is a secret and nothing here
names a product.

## Shape

```
.worktrees/uat/<feature>/<flow>/
  flow.md                     goal, role, preconditions, budget, and the steps with their evidence
  accounts.<env>.json         one dedicated account per alias the steps act as, per environment
  seed/
    README.md                 what is placed, how it stays idempotent, and how it rolls back
    records.json              the records themselves
    fixtures/                 files a record points at
  snapshots/                  the approved reference, changed only by a person
    snapshot.json             { commit, provenance when present, env, approvedBy, approvedAt, sourceRunId }
    <NN-step>-<viewport>-<scheme>.png
    data/after.json           the scoped data state the approved run ended with
  runs/<runId>/               append-only; runId is <yyyymmdd-HHMMss>-<commit7>
    snapshot.json             commit, role provenance {fe, be} for split deliveries, endpoints, registry generation, seed hash, account names,
                              browser profile, approval
    steps/<NN-slug>/
      action.json             what was done, with every input masked
      expected.md             what should have happened
      capture-<viewport>-<scheme>.png
      network.json            console.json            timing.json
    db/before.json  db/after.json
    diff/                     this run against the approved reference
    verdicts.json             the scored criteria, the lane verdicts, the per-step outcome, retained role provenance
    run.md                    the receipt
  latest.json                 { "runId": "<runId>" } — a file, never a symlink
  history.md                  one line per run: runId - commit - verdict - approval
```

## Laws

**A missing record is created, not reported.** A flow that has never run has none of the above, and
that is the ordinary case rather than an error. `flow.md` and `seed/` are drafted from this template
and named in the receipt as drafts; the accounts are provisioned against the identity the runtime
registry declares for the bound route; and the first run leaves a candidate reference. The only
honest stops are a dependency that cannot be reached at all and a registry entry that declares no
identity.

**One alias, one account, one environment.** A flow names its actors by alias in the `as` column of
its steps, and every alias has its own dedicated account, because a flow that is only true when two
roles meet cannot be verified by one. Accounts live in `accounts.<env>.json`: an account of one
environment is not an account in another, and neither is an approved reference.

**A credential is a name.** One password per environment is sealed under the master identity and
every account is set from it. It is resolved by name at the moment it is used and reaches only a
request body or a form field. It never enters a file here, a capture, a log or a receipt, and the
validator scans the whole folder for it rather than trusting the promise.

**Capture begins after the redirect lands.** The frames before that moment are the frames a
credential can be standing in. Captures are PNG and at most 1280 pixels wide, so a history that is
kept forever stays a history someone can clone.

**The data state is whatever the seed says it is.** `db/before.json` and `db/after.json` hold the
scoped state as `seed/README.md` defines it, taken however that document says to take it — a query, an
export over the product's own API, or files. Nothing here requires a database.

**Runs are append-only, and the history is tracked.** A run folder is written once and never edited
or deleted; a second attempt is a new `runId`. The host repository tracks this folder, so the records
travel with the product; only the session folder beside it is ignored. History that lives on one
machine is not history.

**Only a person promotes a reference.** A run may produce a candidate; approving it is a decision,
and `snapshots/snapshot.json` records who made it and when.

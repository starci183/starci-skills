# uat seed

The records a run places before it drives the flow. `uat.verify` reads this directory at step 4, when
it freezes the snapshot, and writes what it finds into the run namespace at step 5.

## Rules

A seed may never create the outcome under test. Seeding the enrolment a purchase flow is supposed to
produce turns a broken purchase into a passing run, which is the one failure a UAT run exists to
catch. Seed the preconditions — the catalogue row, the account's starting balance, the course that
must already exist — and let the flow create the rest.

The count of records a seed places for an entity is the flow's representative volume: the proof
criteria that depend on data volume (`TASTE-9` Case 5) are measured at it, so a seed places as many
records as the surface is meant to carry, not the one row that lets the flow pass.

Every record a seed places carries `is_uat=true` and the `uat-<runId>` namespace. Step 9 deletes
exactly that namespace: not another run's namespace, not a record that merely carries the UAT flag,
and never a run record.

## Where the data state comes from

`db/before.json` and `db/after.json` under a run hold the scoped state this document defines: which
entities, which fields, in which order. How that state is taken is also this document's to say — a
query against the store, an export over the product's own API, or files the fixtures point at. Nothing
requires a database, and a flow whose truth lives in an API says so here.

## Idempotency and rollback

A seed is applied more than once over the life of a flow, so it states what it places, how placing it
again changes nothing, and what undoes it. A seed that only works on an empty store is a seed that
works once.

No secret belongs in this directory. The shared password is resolved by name at the moment it is used and is
never written into a fixture, a command or a file. A seed that needs an authenticated identity names
the alias in `accounts.<env>.json` instead of carrying a credential.

## Layout

| Path | Holds |
| --- | --- |
| `<entity>.json` | One JSON array of records for that entity, in insertion order |
| `order.txt` | The file names in the order they must be applied, when insertion order matters across entities |
| `fingerprint.txt` | Written by the operator, not by hand: the fingerprint the snapshot freezes so a resume can tell whether the seed changed |

## Record shape

Each record is the entity's own shape plus the two fields the namespace requires.

```json
[
  {
    "id": "uat-<runId>-course-1",
    "is_uat": true,
    "namespace": "uat-<runId>",
    "title": "A course that already exists before the flow starts"
  }
]
```

The `<runId>` placeholder is substituted by the operator at step 5. A seed file with a literal run id
committed into it belongs to one past run and is a stale fixture, not a template.

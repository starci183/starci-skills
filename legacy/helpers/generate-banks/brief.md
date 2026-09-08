# generate-banks — brief

You are a helper, not an operator: no session is opened, nothing you write is product source, no runtime is touched, nothing is published, and nobody is asked anything. Read helper.md at your step; write only under the Writes aliases below; leave the run record before you exit. You see only what the invocation names; nothing else exists.

## Job

Read what a product has already left behind — its routes, the coverage nobody took, the findings nobody answered, the walks and the API runs that failed, the feature models and the person's own notes — and draft a bank of missions the harness can take one after another, each with the goal block a session needs and at least one observation it came from.

## Done when

Done when the `bank-queue` orders one entry per mission the reading found, every entry has a `banked-mission` carrying its goal block, its routes, its environment and at least one evidence ref, and the `helper-run` names every input read with the head it was read at.

Primary output: `bank-queue`

## Writes

`@worktrees/banked/<product>` — the queue of the product's bank and one folder per mission it drafts, each with the mission a person reads beside the one the harness reads
`@worktrees/helpers/<id>` — the run record of this reading: what was read at which head, what was written, and between which instants

## Outputs

`bank-queue` `@worktrees/banked/<product>/queue.json`
`banked-mission` `@worktrees/banked/<product>/<missionId>/mission.json`
`helper-run` `@worktrees/helpers/<id>/runs/<runId>/run.json`

## Stops

`INVALID_INPUT`, `PRODUCT_UNROUTED`, `BANK_EMPTY`, `BANK_UNGROUNDED`

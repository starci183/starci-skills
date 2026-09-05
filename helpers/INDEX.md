# Helpers

The support layer beside the operators. An operator does one job on one unit inside a session chain, under a goal a person confirmed; a helper does support work outside any workflow — it opens no session, writes no product source, touches no runtime, publishes nothing and asks nothing. It prepares and tidies. The law is `resources/orchestrator.json#helpers`, the gate is `scripts/validate-helper.mjs`, and this page is generated from every `helpers/<id>/helper.md` by `scripts/generate-helpers-index.mjs`.

A helper is reached from the person and never from a wall: `/helper <id> <args>`, or by naming the job. It runs on its own profile in the mode its `helper.json` declares and leaves one run record under `@worktrees/helpers/<id>/runs/<runId>/`, so every draft it left names the reading that produced it.

## The helpers

| Helper | Profile | Mode | Single job |
| --- | --- | --- | --- |
| `generate-banks` | `astra` | `isolated` | Read what a product has already left behind — its routes, the coverage nobody took, the findings nobody answered, the walks and the API runs that failed, the feature models and the person's own notes — and draft a bank of missions the harness can take one after another, each with the goal block a session needs and at least one observation it came from. |

## generate-banks

**Job.** Read what a product has already left behind — its routes, the coverage nobody took, the findings nobody answered, the walks and the API runs that failed, the feature models and the person's own notes — and draft a bank of missions the harness can take one after another, each with the goal block a session needs and at least one observation it came from.

**Done when.** Done when the `bank-queue` orders one entry per mission the reading found, every entry has a `banked-mission` carrying its goal block, its routes, its environment and at least one evidence ref, and the `helper-run` names every input read with the head it was read at.

### Reads

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/projects` | the product's route declarations: which roles it has and what each one is, so a drafted mission names routes that exist | yes |
| `@workspaces/ports` | the port projection of the product, so a mission that needs a served runtime names the slot it would run on | no |
| `@workspaces/<project>/<role>` | the product's routed checkouts, read only and at their observed head: what a `source:` evidence ref points at, and what tells a promise already delivered from one still owed | no |
| `@worktrees/unchecked/<product>` | the coverage earlier missions deliberately did not take, each with its lane, its unit and its reason: the first source of a mission nobody has run yet | no |
| `@knowledge/findings` | the findings audits and walks recorded and nobody has answered, per family | no |
| `@worktrees/uat/<flow>` | the walks this product has run and what they failed on | no |
| `@worktrees/e2e/<flow>` | the API runs this product has run and which cases they failed | no |
| `@worktrees/businesses` | the feature models and the promises they publish, so a drafted mission is about a promise and not about a file | no |

### Writes

| Alias | What |
| --- | --- |
| `@worktrees/banked/<product>` | the queue of the product's bank and one folder per mission it drafts, each with the mission a person reads beside the one the harness reads |
| `@worktrees/helpers/<id>` | the run record of this reading: what was read at which head, what was written, and between which instants |

### Steps

| # | Step | Writes | Stops with |
| --- | --- | --- | --- |
| 1 | Validate the invocation and its arguments | — | `INVALID_INPUT` |
| 2 | Read the product's route declarations, its port projection and the head of each routed checkout | — | `PRODUCT_UNROUTED` |
| 3 | Read the open entries of the product's unchecked ledger, each with its lane, its unit and its reason | — | — |
| 4 | Read the open findings of every family this product composes | — | — |
| 5 | Read the last walk of every flow and the last API run of every e2e flow, and what each one failed on | — | — |
| 6 | Read the feature models this product publishes and the person's notes the invocation named | — | — |
| 7 | Draft one mission per open thread: its goal block, its routes, its environment, its evidence refs and its tier hint | `banked-mission` | `BANK_EMPTY` |
| 8 | Refuse every draft that names no evidence ref, naming the thread it came from | — | `BANK_UNGROUNDED` |
| 9 | Order the queue by what each mission waits for, then by priority | `bank-queue` | — |
| 10 | Record the run: every input with the head it was read at, every output written, the profile and the two instants | `helper-run` | — |

### Outputs

| Kind | File |
| --- | --- |
| `bank-queue` | `@worktrees/banked/<product>/queue.json` |
| `banked-mission` | `@worktrees/banked/<product>/<missionId>/mission.json` |
| `helper-run` | `@worktrees/helpers/<id>/runs/<runId>/run.json` |

### Stop codes

| Code | Disposition | Means |
| --- | --- | --- |
| `INVALID_INPUT` | terminate | request.json fails the gate or the operator's Requirements. |
| `PRODUCT_UNROUTED` | terminate | The product names no route declaration under @workspaces/projects, so there is nothing to draft a mission against: a bank whose missions name roles that do not exist cannot be planned when it opens. |
| `BANK_EMPTY` | terminate | Nothing the reading covers is open: no unchecked entry, no unanswered finding, no failed case and no promise the models carry that a delivery does not reach. Nothing is written, because an empty bank is a fact about the product rather than a bank. |
| `BANK_UNGROUNDED` | terminate | A drafted mission names no evidence ref. It is refused rather than banked with a plausible reason, because the person approves a bank once and the harness then runs every mission in it. |

Source: `helpers/generate-banks/helper.md`.


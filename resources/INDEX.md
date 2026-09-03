# Resources

Who runs each operator, with what, and under which standing policies. Two closed places carry it:

- `agents/profiles/<runtime>.json` — one file per runtime (`openai.json`, `claude.json`); the file owns
  its provider, a profile carries model, isolation, what the model can do here
  (`capabilities`), and what an operator on that profile is allowed to use (`permits`).
- `operators/<id>/operator.json` → `resources` — inside each operator: the one profile that runs it
  end to end, which grants it actually requires, and its answers to the three standing questions.
  Each operator's `operator.md` names the same aliases in its Context table. There is no central assignment file.

`scripts/validate-resources.mjs` runs inside `npm test`. It rejects an operator whose `operator.json` declares no
`resources`, an operator bound to an unknown profile, a required grant no assigned profile permits, a profile that permits
what its model cannot do, a policy answer that
contradicts the grants, a model an operator's own schema pins that is not its profile's model, and a row of the
process matrix below that disagrees with the operator it summarises. The registry, the operators,
and this summary therefore cannot drift apart silently.

## Binding rule

An operator binds exactly one profile and runs on it end to end, never per invocation and never
split across profiles: a critique, review, or judgement inside an operator is a step of that one
execution, and a second model for it would be a workflow. The profile decides the model and the
isolation; the operator's `operator.md` Steps decide the work; `resources.requires` decides which grants that
work may touch. A grant absent from `requires` is unavailable to the operator even if the profile
would permit it. Capability is a fact about the model; permission is a policy about the
operator: `gpt-5.6-sol` can search, draw, drive a browser, and write source, so `sol-fresh` may use all
four, while `sol-reviewer` on the same model is permitted only the browser, because a reviewer that
produces is no longer a reviewer. Material brainstorms and reviews are always one fresh execution with no inherited
turns, and a reviewer receives artifacts and claims, never the producer's rationale.

## The three standing questions

**Does it search the web when the tree holds no reference?** Only where `policy.webSearch` is
`bounded`: the decision operators and the content brief. Research is bounded by the exact gap it must
close, records what it used, and never copies a page, brand, palette, or component anatomy. A
presentation value the knowledge does not publish is `RULE_MISSING`, never a research task.

**Is it bound to published Grammar?** Where `policy.grammarBound` is true: the four frontend
operators. Direction binds Grammar compositions; presentation resolves only against Grammar's owned
relationships; apply writes only resolved classes; audit judges against the same law. A missing
reusable capability is `GRAMMAR_REQUIRED` or `COMMON_CAPABILITY_MISSING`, never a local imitation.

**Does it generate images?** `required` only in content generation, where an image is made to a
stated claim and inspected for fidelity to it. `authority-only` in frontend direction: the direction
itself renders an inspectable page, and product artwork is generated only when product authority
names it. Everywhere else, `never`.

## Process matrix

A summary of what each `operator.json` declares; the validator rejects a row that disagrees.

| Operator | Profile | Grammar | Tools | Why |
| --- | --- | --- | --- | --- |
| `workspace.bind` | luna | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name` | Reads canonical files and a registry; no judgement |
| `business.decide` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded` | An unfamiliar business model may need reference research before coverage can be frozen |
| `architecture.decide` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html` | Alternatives and compatibility need evidence beyond the repo; schema pins the model |
| `backend.source.apply` | luna | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | Writes inside a frozen contract following patterns/be |
| `frontend.direction.decide` | sol-fresh | yes | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `imagegen:judged`, `visualize:html` | Research only for an unfamiliar domain; renders candidates as pages and judges for itself when a region is too empty to stand without an image |
| `frontend.presentation.resolve` | luna | yes | `fileread:context-aliases`, `git:read`, `registry:read` | A lookup against a closed inventory |
| `frontend.source.apply` | luna | yes | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `shell:declared-commands`, `git:commit-session-branch`, `imagegen:judged` | Writes only what the resolution already contains, following patterns/fe |
| `frontend.surface.audit` | sol-reviewer | yes | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe` | Browser only, no source write: the auditor cannot repair what it measures |
| `quality.verify` | luna | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe` | Runs gates, repairs nothing |
| `uat.verify` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `secrets:resolve-by-name`, `database:namespaced-write` | Drives the real journey in a browser and may write nothing; fresh verdict per lane |
| `release.deploy` | luna | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `ci:read`, `secrets:resolve-by-name` | Immutable release under declared authorization |
| `platform.operate` | luna | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `secrets:resolve-by-name` | Shared services from exact evidence |
| `content.generate` | luna | no | `fileread:context-aliases`, `shell:declared-commands`, `websearch:bounded`, `imagegen:required`, `objectstorage:read` | Researches the brief within bounds, then writes, codes, and draws to a claim; the schema pins this model |
| `git.publish` | luna | no | `fileread:context-aliases`, `git:merge-and-push`, `shell:declared-commands`, `ci:read` | Non-force publication; destructive operations are unrepresentable |

## Profiles

### Runtime `openai` (provider `openai`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | web, images, browser, source | web, images, browser, source | Decisions and direction, end to end |
| `sol-reviewer` | `gpt-5.6-sol` | web, images, browser, source | browser | Audits and UAT; observes, never writes |
| `luna` | `gpt-5.6-luna` | web, images, source | web, images, source | Authored content, end to end |

### Runtime `claude` (provider `anthropic`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `opus` | `claude-opus-5` | web, browser, source | browser, source | Heavy authoring and high-stakes mutation |
| `sonnet` | `claude-sonnet-5` | web, browser, source | source | Deterministic and mechanical work |
| `fable` | `claude-fable-5-1` | web, browser, source | source | Source-grounded extraction and audits |

`fable` is registered for the audit and extraction work that produced `patterns/`; no operator binds
it today.

## What may change here

A profile's model or grants, an operator's profile, and any policy answer are owner decisions.
Changing one is an edit in the profile file or the operator's `operator.json`, the matching line in
its `operator.md`, and a green `npm test`. Adding a grant kind means adding
it to every profile explicitly, because the validator refuses a profile that leaves a grant unstated.

# Resources

Who runs each operator, with what, and under which standing policies. Two closed places carry it:

- `agents/profiles/<runtime>.json` — one file per runtime (`codex.json`, `claude.json`); the file owns
  its provider, a profile carries model, isolation, what the model can do here
  (`capabilities`), and what a role on that profile is allowed to use (`permits`).
- `assignments.json` — one entry per operator: which profile runs each role, which grants the
  operator actually requires, and its answer to the three standing questions.

`scripts/validate-resources.mjs` runs inside `npm test`. It rejects an operator with no assignment, a
role bound to an unknown profile, a required grant no assigned profile permits, a profile that permits
what its model cannot do, a policy answer that
contradicts the grants, and a model an operator's own schema pins that no assigned profile uses. The
registry and the operator contracts therefore cannot drift apart silently.

## Binding rule

An operator binds a profile per role, never per invocation. The profile decides the model and the
isolation; the operator's `execute.md` decides the work; the assignment decides which grants that
work may touch. A grant absent from `requires` is unavailable to the operator even if the profile
would permit it. Capability is a fact about the model; permission is a policy about the
role: `gpt-5.6-sol` can search, draw, drive a browser, and write source, so `sol-fresh` may use all
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

| Operator | Roles → profile | Web | Grammar | Images | Why this shape |
| --- | --- | --- | --- | --- | --- |
| `workspace.bind` | resolve → sonnet | never | no | never | Reads canonical files and a registry; no judgement |
| `business.decide` | decide → sol-fresh, critique → sol-reviewer | bounded | no | never | An unfamiliar business model may need reference research before coverage can be frozen |
| `architecture.decide` | decide → sol-fresh, critique → sol-reviewer | bounded | no | never | Alternatives and compatibility need evidence beyond the repo; schema pins the model |
| `backend.implement` | implement → opus | never | no | never | Writes inside a frozen contract following patterns/be |
| `fe.direction.decide` | decide → sol-fresh, visualReview → sol-reviewer | bounded | yes | authority-only | Research only for an unfamiliar domain; renders a page, not a picture |
| `fe.presentation.resolve` | resolve → sonnet | never | yes | never | A lookup against a closed inventory |
| `fe.source.apply` | apply → opus | never | yes | never | Writes only what the resolution already contains, following patterns/fe |
| `fe.surface.audit` | capture → sonnet, judge → sol-reviewer | never | yes | never | Capture is mechanical; the judge sees rasters and claims only |
| `quality.verify` | verify → sonnet | never | no | never | Runs gates, repairs nothing |
| `uat.verify` | drive → opus, judge → sol-reviewer | never | no | never | Real journey with an auto-provisioned learner; fresh verdict per lane |
| `release.deploy` | operate → opus | never | no | never | Immutable release under declared authorization |
| `platform.operate` | operate → opus | never | no | never | Shared services from exact evidence |
| `content.generate` | brief → sol-fresh, produce → luna, critique → sol-reviewer | bounded | no | required | Brief may research; production writes, codes, and draws to a claim; critique is independent |
| `git.publish` | publish → sonnet | never | no | never | Non-force publication; destructive operations are unrepresentable |

## Profiles

### Runtime `codex` (provider `openai`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | web, images, browser, source | web, images, browser, source | One fresh decision or brainstorm, end to end |
| `sol-reviewer` | `gpt-5.6-sol` | web, images, browser, source | browser | One fresh reviewer; artifacts and claims only |
| `luna` | `gpt-5.6-luna` | web, images, source | images, source | Production of authored content |

### Runtime `claude` (provider `anthropic`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `opus` | `claude-opus-5` | web, browser, source | browser, source | Heavy authoring and high-stakes mutation |
| `sonnet` | `claude-sonnet-5` | web, browser, source | source | Deterministic and mechanical work |
| `fable` | `claude-fable-5-1` | web, browser, source | source | Source-grounded extraction and audits |

`fable` is registered for the audit and extraction work that produced `patterns/`; no operator role
binds it today.

## What may change here

A profile's model or grants, an operator's role binding, and any policy answer are owner decisions.
Changing one is a one-line edit in the JSON plus a green `npm test`. Adding a grant kind means adding
it to every profile explicitly, because the validator refuses a profile that leaves a grant unstated.

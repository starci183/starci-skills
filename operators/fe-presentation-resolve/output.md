# Output of `fe.presentation.resolve`

The operator returns one closed envelope with `outcome` equal to `resolved` or `blocked`. It never
emits a handoff or free-form routing instruction.

## Resolved receipt

A resolved receipt contains:

- exact project, source, target, tree, knowledge, Grammar, input, and progress bindings;
- the resolved tree reference and its fingerprint;
- one decision per node and property, naming the owner, the rule, the emitted class, and the observed
  condition that selected it;
- one contract per application-owned node, listing the identifiers that node claims;
- the complete set of applied identifiers;
- findings for Grammar-owned properties, missing capabilities, and removed classes.

The receipt authorises a later audit to measure the rendered result against the claims. It does not
prove that the tree renders correctly, and it carries no verdict, score, or pass claim.

## Decisions

Each decision names one owner:

| Owner | Meaning | Class | Contract |
| --- | --- | --- | --- |
| `app` | The application owns the boundary | Required | Published |
| `grammar` | A Common component already owns it | Forbidden | None |
| `none` | Common exposes no public path | Required, as a workaround | Published |

`owner: "grammar"` still names the rule the component satisfies, so an audit can check the component
against the same law as the application. `owner: "none"` requires a matching
`COMMON_CAPABILITY_MISSING` finding; a workaround that records nothing would read as an ordinary pass.

## Contracts

A contract is a claim, not a verdict. It states which rules a node intends to satisfy so a later
audit can contradict it.

Every application-owned node publishes one. A node that carries a presentation class without a
contract is rejected, because an unclaimed value is exactly what no audit can check.

## Blocked receipt

A blocked receipt has no resolution. It contains one typed failure, the exact nodes and references
involved, the owning domain, retryability, and, only when retryable, a single-use resume token with
the required material delta.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `SOURCE_DRIFT` | The observed source no longer matches the frozen head. | Refreshed source binding. |
| `OWNER_CONFLICT` | A node needing mutation lies outside the mutable ceiling. | Corrected owner authority. |
| `KNOWLEDGE_UNBOUND` | A property is present in the tree with no topic bound for it. | The missing topic binding. |
| `UNKNOWN_RULE` | An identifier outside the bound inventory was reached for. | The topic that publishes it, or a corrected identifier. |
| `RULE_MISSING` | No published case matches the observed condition. | The published case, and a rebound topic fingerprint. |
| `GRAMMAR_UNPUBLISHED` | The Grammar package is unpublished or its fingerprint is stale. | The published package. |
| `NO_PROGRESS` | A resume adds no effective delta. | Materially new knowledge, Grammar, tree, or scope. |

`RULE_MISSING` is the expected outcome when the knowledge is incomplete, not a defect in the tree. It
is owned by the knowledge author, and resolving the same tree again after publication is the correct
next step.

## Cross-field invariants

- `outcome="resolved"` requires `receipt.status="resolved"`, non-null `resolution`, null `failure`,
  and null `resume`.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `resolution`, and non-null `failure`.
  A retryable failure requires a resume; a non-retryable failure forbids one.
- Every decision resolves one property on one node exactly once.
- Every application-owned or workaround decision names a rule present in `appliedRuleIds`.
- Every Grammar-owned decision has a null class and names the rule the component satisfies.
- Every contract identifier is applied, and its node has a matching decision.
- Every application-owned node publishes a contract.
- Every `owner: "none"` decision has a `COMMON_CAPABILITY_MISSING` finding on the same node and
  property.
- A scale-topic class agrees with its identifier's ordinal. `GAP-5` renders `gap-6`, `PADDING-5`
  renders `p-6`, and `MARGIN-AUTO` renders an `auto` token.
- `artifactRefs` registers the resolved tree.
- `handoff` is always `null`.

## Practical outcomes

Resolve a dashboard tree: the page region stack takes `GAP-5`, the block stack inside one section
takes `GAP-4`, card content resolves to the card as owner and emits no class, and the compact
identity pair emits `gap-1` as a recorded workaround. Three nodes publish contracts and one does not,
because its owner is a component.

Resolve a tree with an unrepresented relationship: the invocation returns `RULE_MISSING` naming the
node, and no value is chosen anywhere in the tree.

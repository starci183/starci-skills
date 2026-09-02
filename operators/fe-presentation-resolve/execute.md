# Execute `fe.presentation.resolve`

## Single job

Turn one already-composed tree into the same tree with every application-owned presentation property
resolved to exactly one published rule. This is one linear operator invocation. It does not call
another operator, route a workflow, pause internally, or change what the tree renders.

Structure, element order, Grammar component selection, copy, data, and behaviour arrive decided. This
operator only answers, for each node the application owns, which value each presentation property
takes and which rule authorises it.

## No fabricated rule

A rule exists only if the bound knowledge topic publishes its identifier. That inventory arrives in
`context.knowledge.topics[].ruleIds` and is frozen by fingerprint for the whole invocation.

Four prohibitions carry this, and each is enforced rather than advised:

1. An emitted identifier absent from the inventory is `UNKNOWN_RULE`.
2. An identifier emitted under a topic that does not publish it is invalid input, because a
   cross-filed identifier is how a fabricated rule enters unnoticed.
3. A class that contradicts its identifier is rejected. The rule number is an ordinal on the value
   scale, so `GAP-5` renders `gap-6` and `PADDING-5` renders `p-6`. Writing the ordinal as the step
   is the defect this check exists to catch.
4. When no case in the bound rule matches the observed condition, the invocation stops with
   `RULE_MISSING` naming that node. It does not choose a nearby value, round to the closest step, or
   copy a neighbouring node.

The operator never edits knowledge. A missing case is returned to the knowledge owner, and the same
tree is resolved again once the case is published and the topic fingerprint is rebound.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/fe-surface-audit/<invocationId>` (regression history), `@workspaces/fe` (the frozen head binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@knowledge/ui/presentation` (every topic with its fingerprint and inventory), `@grammar` (the published package and the relationships it owns), `@workspaces/fe` (routed head, frozen tree), `@receipt/fe-direction-decision/<invocationId>` (intent) | — | `KNOWLEDGE_UNBOUND`, `GRAMMAR_UNPUBLISHED` |
| 3 | Walk the tree once | `@workspaces/fe` (the frozen tree), input (the mutable owner ceiling) | — | `OWNER_CONFLICT` |
| 4 | Determine the owner for each present property | `@grammar` (the owned relationships), `@workspaces/fe` (the properties the node presently carries) | — | — |
| 5 | Select one rule per remaining property | `@knowledge/ui/presentation` (the cases the bound topic publishes) | — | `RULE_MISSING` |
| 6 | Classify a missing public path | `@grammar` (the relationship under question), `@knowledge/ui/presentation` (the capability-gap marking) | — | — |
| 7 | Remove what the tree should not carry | `@workspaces/fe` (the application classes on the node), `@grammar` (Grammar anatomy and the closed scale) | — | — |
| 8 | Emit contracts | `@knowledge/ui/presentation` (the frozen rule inventory), input (`contractEmission`) | — | `UNKNOWN_RULE` |
| 9 | Emit and stop | everything above | `@artifacts/<target>.resolved.tsx` | — |

Validation rejects a stale source binding, owner overlap, duplicate topics, cross-filed identifiers,
and unchanged progress. The walk visits every node in document order and records a stable `nodePath`;
a node outside the mutable owner ceiling is observed and never mutated.

Grammar relationships are consulted first, so a property a component already owns resolves to
`owner: "grammar"`, emits no class, names the rule the component satisfies, and records
`GRAMMAR_OWNED`. That ordering is deliberate: it makes reimplementation impossible rather than merely
discouraged. Exactly one published case may match an observed condition; two matching cases mean the
knowledge is ambiguous and the invocation stops rather than choosing.

When the relationship has no Common owner and the knowledge marks it a capability gap, the property
resolves to `owner: "none"`, emits the class the rule declares, and records
`COMMON_CAPABILITY_MISSING`; that class is a recorded workaround, never a silent pass. An application
class that reimplements a Grammar-owned relationship, overrides Grammar anatomy, or sits off the
closed scale is deleted with its matching finding, reported per node and never silently.

Every application-owned node publishes the identifiers it claims. With `contractEmission: "attribute"`
the resolved tree carries `data-contract` as a space-separated token list; with `receipt-only` the
tree carries nothing and the receipt alone holds the claims. Emission writes the resolved tree under
`input.project.artifactRootRef`, returns one output conforming to `output.schema.json`, binds every
fingerprint, and claims no visual, quality, or UAT proof.

## The contract is a claim, not a verdict

`data-contract` records which rules a node claims to satisfy. It never asserts that the node passes.
The claim exists so a later audit can measure the rendered result and compare it against a stated
intention, which turns three silent failures into detectable ones:

- a node claims `GAP-4` while the computed gap is `1.5rem`, so the claim and the pixels disagree;
- a node carries spacing and claims nothing, so nobody owns the value;
- a node claims an identifier the published knowledge does not contain.

The attribute is a token list so one rule is selectable directly, as `[data-contract~="GAP-4"]`. It
is build-strippable, and the receipt remains the durable record when it is stripped, so an audit of a
production tree still resolves every claim.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta. A resume that adds no knowledge, Grammar, tree, or scope change returns
`NO_PROGRESS`. Republished knowledge must arrive as a new topic fingerprint; the same fingerprint
cannot yield a different answer.

## Mandatory attacks

The operator cannot resolve while any applicable item remains unresolved:

- a property is present in the tree and no topic is bound for it;
- two cases in one rule match the same observed condition;
- an emitted class and its identifier disagree about the value;
- a node carries a presentation class but publishes no contract;
- a workaround is emitted without recording the missing capability;
- a Grammar-owned relationship is also written by the application;
- a removed class carries meaning the resolved tree no longer expresses.

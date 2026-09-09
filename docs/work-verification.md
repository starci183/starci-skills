# Useful verification and dependency repair

`.starciwork` is a tree of owned, typed contracts, not a collection of audit forms.
Its folders organize scope; stable IDs, typed design imports, `refs` and
`dependsOn` form a graph that can cross folders and module boundaries. Shared
design has one owner. Parent nodes aggregate current required children, rather
than declaring a separate manual completion.

## What earns completion

Use each layer's supported schema and verification profile. The common question
is whether the actual result satisfies its current inputs and acceptance, with
enough specific support for another reviewer to judge it.

| Layer | Meaning of the result and its support |
| --- | --- |
| Business/SRS | Reviewed authorized outcomes, complete relevant flows and rules, consistent acceptance; not passing code tests. |
| Architecture/SDS | Reviewed mechanisms, ownership, connections and significant failure paths realizing SRS and shared contracts; not proof of deployed behavior. |
| UI | Reviewed screens, states and interactions covering the selected journeys and Grammar; design pictures are not screenshots of working code. |
| Implementation | Actual behavior delivered, meaningful design-to-code boundaries, exact source identity and checks performed, with explicit remaining gaps. |
| UAT | Current SRS outcomes compared with observed behavior of an identified running build/environment, including usable captures where needed. |

Examples illustrate the judgment, not compulsory fields for every node. Use
current typed fields; a prose example does not authorize invented schema keys.
Business/SDS record current review inside `completion.review`. Implementation,
E2E and UAT can retain useful evidence through their existing supported profiles.
Do not create an evidence directory just to copy a specification into it, or
delete actual test output, screenshots or videos to satisfy a naming preference.

## Identify what was actually checked

For committed source, bind the exact repository and revision. Explain what was
delivered and why it matters; do not repeat the Git changed-file inventory.
Optional source anchors are useful only when they clarify a non-obvious boundary
or a particular gap. Planned work must not masquerade as implemented behavior.

A commit alone is not a test result. A test on a dirty working tree is not a test
of HEAD: retain a reproducible identity of the tested changes with the result, or
rerun on the final identified revision. Never label an unrecorded dirty run as
current final verification. Similarly, a UAT URL alone does not identify the
served artifact; connect the observed build to the implementation being accepted.
If that connection is unverified, say so and do not use the run to accept that
implementation. Separate source identity, execution context and observed result.

Record checks proportionately: what criterion they exercise, expected versus
actual outcome, the tested subject, and important limits/doubles. Preserve raw
results or media where they materially support the claim. Report pass, fail,
skipped, not-run and inconclusive distinctly; a required skipped or unverified
criterion cannot become pass. A useful bounded unit test is not full integration,
and a simulated provider is not a live provider result.

For visual outputs, identify AI-generated `interface.draw` designs separately
from screenshots captured from the actual product. Record the real environment;
do not label a local/staging capture as production, or use a production baseline
image as proof of a new implementation. A design and a runtime capture answer
different questions even when they look identical.

Do not force all this into every node or add a parallel manifest registry. Use
the owning implementation/UAT record and its supported verification artifacts;
extend a typed contract only when a real result cannot be represented honestly.
Never put credentials or real customer data into audit records or captures.

## Repair the failing link, then affected consumers

1. Trace a discrepancy to its owner: requirement, design, implementation, test
   expectation/fixture, or environment. Passing a schema does not settle that.
2. Repair the owning current contract within authority. An existing done is not
   an edit lock. New business policy still requires its actual decision maker.
3. Follow declared dependencies and typed imports to find affected consumers.
   `refs` propagate semantic change but do not impose execution order;
   `dependsOn` expresses prerequisites that must currently be done. Include
   genuine shared imports, not every nearby folder.
4. Review or rerun appropriate checks and bind completion to current inputs.
   Inspect `effectiveState`; a retained stored done on stale inputs is not done.
   Preserve unrelated completed branches and useful prior results without
   presenting them as proof for the changed version.

Hashes detect changes to declared inputs, not missing edges or wrong semantics.
Review the dependency graph as well as its digests. Schema validation establishes
structure and consistency; substantive review and actual execution establish
whether the claimed result is true. Neither substitutes for the other.

# Output correctness loop

Observe the produced output before consulting prompts, code, rules, knowledge, or producer rationale.
Freeze one acceptance contract and reuse it unchanged for the baseline, every retry, and the stability
pass. Passing state transitions or validators never override a wrong output.

For a failed or inconsistent output, check each required layer independently:

1. `objective-scope`: the requested outcome, exclusions, authority, and proof target;
2. `input`: fixture completeness, ambiguity, ordering, freshness, and lost constraints;
3. `prompt`: task framing, context selection, expected output, negative boundaries, and overconstraint;
4. `state-machine`: missing, skipped, premature-terminal, looping, and unreachable states;
5. `execute-logic`: whether operators perform the declared job in the required order;
6. `knowledge`: applicability, contradictions, missing guidance, and stale rules;
7. `grammar` and `ui`: only when the output is UI-owned; conformance cannot excuse a bad output;
8. `validation`: whether schemas and cross-field checks reject the observed failure;
9. `output-contract`: whether success represents the user outcome instead of procedural completion;
10. `tool-model`: availability, isolation, media purpose, and evidence visibility;
11. `proof`: fresh evidence, reviewer independence, metrics, and repeatability.

Record `passed`, `finding`, or evidence-backed `not-applicable` for every required layer. Repair the
smallest owner that explains the output failure. Rerun from fresh evidence and a new fingerprint; do
not tune a downstream implementation repeatedly when the same finding indicates an upstream prompt,
input, knowledge, Grammar, validator, or state-machine defect.

Closure requires two consecutive passes against the unchanged acceptance contract. Stop after three
failed repairs or immediately when a fingerprint repeats. Report the last wrong output and unresolved
owner; never convert exhaustion into success.

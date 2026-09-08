# quality.verify

Runs declared delivery gates against one frozen source head and reports what they measured. It binds at least one producer receipt, refuses mixed predecessor heads, preserves configured and requested coverage thresholds, applies the declared lint scope and copies same-head audit or UAT scorecards without rescoring them.

This operator repairs nothing. Gate build and test commands may create their normal disposable outputs, but the operator does not edit product source. An unavailable or unexecuted gate is not passed. Debt applies only when an unexpired owner approval names that exact red gate; it cannot excuse source drift or a boundary failure.

A done response includes `quality-verification` and `gate-results`. The criteria loop records exact failing commands, thresholds, debt or provenance defects, then reruns only affected gates after an external repair, for at most two rounds.

The tests compile the bundle and validate synthetic records. They execute no repository delivery gates. Run `python .claude/operators/quality.verify/tests/run.py`.

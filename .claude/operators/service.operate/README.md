# service.operate

Brings one environment-declared auxiliary service to `up`, `down` or `attested`. The declaration supplies its kind, exact command, functional probe, holder policy and port; an existing declaration or person approval must cover the requested state.

The service's own probe decides observed state. `up` also records the answering pid; `down` proves the declared port is free. Command exit or logs alone prove neither. `attested` changes nothing, and an already matching desired state is a proved no-op. The operator never moves a port, stops a foreign process, operates a product runtime or records credential values. Uncertain completion is probed and inventoried before any retry.

A done response contains `service-receipt`. Review covers declaration authority, inventory safety, desired versus observed state, attestation and no-op behavior, and duplicate-effect prevention. Feedback is bounded to two rounds.

Tests use synthetic local records and do not start, stop or probe a real service. Run `python .claude/operators/service.operate/tests/run.py`.

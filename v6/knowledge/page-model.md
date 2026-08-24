# Page model normalization

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.page-model` |
| Operators | `page-model` |
| Search tags | `page model, block, global ref, reading order, normalized content` |
| Dependencies | `fe.customer-journey` |

## Record

Turn an approved journey into normalized pages and purposeful Blocks before composing visual layout.

## Page contract

Every page declares one user goal, its entry evidence, completion condition, primary action, secondary actions, and the blocks required to reach the goal. A Block is named by responsibility, not appearance: it owns one coherent piece of meaning, interaction, state, or supporting reference.

For each block record:

- purpose and owned information;
- source of its data and state;
- relationship to the page goal;
- information weight: primary, supporting, or peripheral;
- expected density and minimum readable width;
- whether it is page-local or a reference to a journey-global owner;
- interaction and state obligations;
- what it deliberately does not own.

Normalize raw text into headings, explanatory copy, structured facts, collections, actions, validation, feedback, and supporting guidance. Do not choose a card, tab, rail, column span, or sticky behavior here. Those are layout and grammar decisions.

Two dense subjects with separate goals normally become separate Blocks. Peer content under one page goal may become switchable panels only when simultaneous visibility has no comparison value. Repeated journey information becomes one global Block with refs.

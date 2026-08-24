# Layout output

Return one JSON value that validates against `output.schema.json`.

The output contains two or three materially different layout directions. Every direction must:

- keep the same approved flow, page inventory, global-block ownership and evidenced states;
- give every page a semantic reading order;
- define wide, intermediate and compact tracks;
- place every visible block in each viewport form and explain why its span, order and persistence match its task weight and content density;
- state when a supporting block remains a narrow track, moves inline or becomes a named replacement control;
- make every sticky choice explicit, including reason, scroll owner, release condition and compact behavior;
- preserve one global journey-progress owner across the whole journey;
- name its material differences, trade-offs and proof obligations.

Directions differ in a consequential composition axis, not in colour, wording or arbitrary card decoration. They remain block-level: no class names, exact package exports or local component invention.

The operator recommends one direction but does not approve it. It returns `layout.review/pending` and the exact commands `OK LAYOUT <direction-id>`. No implementation or third creative checkpoint begins until one command is received.

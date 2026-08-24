# Layout input

Layout starts after one customer-flow direction has been approved and its pages, global blocks, page-local blocks and states have been normalized.

Provide one JSON value that validates against `input.schema.json`.

Required input:

- the run identity and either the first `layout.generate/ready` transition or a rejected `layout.review` transition;
- the immutable approved-flow artifact reference, hash and candidate ID;
- the page-model artifact reference and hash;
- the state-model artifact reference and hash;
- a closed list of block summaries. Each summary states its page/global owner, task weight, content density, data volume, reading dependencies and visibility conditions;
- journey-progress ownership when the approved flow has multiple ordered pages;
- rejection feedback when regenerating directions.

The block summaries may describe observable structure and task relationships. They must not contain CSS classes, package imports, component names or a preselected visual answer. Source-contract and Grammar payloads are intentionally withheld here so that current implementation does not become a layout precedent.

Tabs are admitted only when panels are mutually exclusive views of the same page-level task. A multi-page journey uses one global journey-progress block referenced by every participating page; it is not converted into tabs.

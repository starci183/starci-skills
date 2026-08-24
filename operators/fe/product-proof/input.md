# Product Proof input

Product Proof receives implemented source, reproducible Product Seed evidence and the layout approval binding. It is the final judge of the FE app run.

The input validates against `input.schema.json` and enters only at `proof.run / ready` with all seed, unit, E2E, and UI evidence facts.

It binds:

- the selected flow and approved layout hashes;
- the exact approved source boundary;
- the source change set and seed evidence;
- required static gates, browser scenarios, viewports and state IDs;
- thresholds and evidence destinations.

Browser scenarios must exercise the product interaction that reveals each state. A screenshot alone is not interaction proof. Every required journey page, global journey-progress owner, responsive transformation and evidenced state must have an explicit assertion.

The input may define no new creative checkpoint. Flow approval and layout approval are the only approval types in this app.

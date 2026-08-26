# Execute `fe/visual-fidelity`

## Step 1 — Reproduce approved states

**Read:** approved detail, baselines, deterministic seed, and running app. **Context:** use the same viewport, theme, state, and data seed. **Session write:** observed screenshots and DOM anatomy. **Stop:** on missing or non-reproducible baseline.

## Step 2 — Compare structure before pixels

**Read:** approved and observed anatomy. **Context:** orchestration may parallelize viewports and states. Compare the exact Grammar object chosen for every region before comparing appearance: branch identity, contract identity, surface ownership, repeated-row ownership, separators, state marks, labels, and actions. **Session write:** Grammar object/contract identity, surface count/nesting/order, breadcrumb, icon, separator, state-marker mapping, action, sticky/scroll, responsive, interaction, and accessibility checks. **Stop:** any structural deviation, generic-object substitution, label-only legend, or missing state distinction is hard failure regardless of lint or pixel similarity.

## Step 3 — Route the owner of failure

**Read:** comparison findings only. **Context:** implementation drift routes to implementation; approved-detail defects route to UI detail. **Session write:** typed failures and state. **Stop:** before UAT unless all hard checks pass.

# Execute `fe/visual-fidelity`

## Step 1 — Reproduce approved states

**Read:** approved detail, baselines, deterministic seed, and running app. **Context:** use the same viewport, theme, state, and data seed. **Session write:** observed screenshots and DOM anatomy. **Stop:** on missing or non-reproducible baseline.

## Step 2 — Compare structure before pixels

**Read:** approved and observed anatomy. **Context:** orchestration may parallelize viewports and states. **Session write:** surface count/nesting/order, breadcrumb, icon, separator, action, sticky/scroll, responsive, interaction, and accessibility checks. **Stop:** any structural deviation is hard failure regardless of lint.

## Step 3 — Route the owner of failure

**Read:** comparison findings only. **Context:** implementation drift routes to implementation; approved-detail defects route to UI detail. **Session write:** typed failures and state. **Stop:** before UAT unless all hard checks pass.

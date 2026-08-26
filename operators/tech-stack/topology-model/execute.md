# Execute `tech-stack/topology-model`

## Step 1 — Bind inventory and approved constraints

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** coordinator binds identities and validates output.

## Step 2 — Model observed and proposed-target claims separately

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** independent evidence slices may run in parallel and the coordinator merges only typed findings.

## Step 3 — Detect contradictions and emit a typed stack model

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** do not emit success with unresolved critical contradictions. **Orchestration:** coordinator binds identities and validates output.

# Execute `tech-stack/discover`

## Step 1 — Bind the approved project and source fingerprint

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** coordinator binds identities and validates output.

## Step 2 — Inspect only declared manifests, configuration and deployment evidence

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** independent evidence slices may run in parallel and the coordinator merges only typed findings.

## Step 3 — Emit an observed inventory with evidence for every fact

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** do not emit success with unresolved critical contradictions. **Orchestration:** coordinator binds identities and validates output.

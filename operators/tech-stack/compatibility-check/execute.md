# Execute `tech-stack/compatibility-check`

## Step 1 — Bind the exact stack-model hash

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** coordinator binds identities and validates output.

## Step 2 — Check versions, deployment units, communication failures and datastore ownership

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** independent evidence slices may run in parallel and the coordinator merges only typed findings.

## Step 3 — Return compatible only when critical contradictions are resolved

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** do not emit success with unresolved critical contradictions. **Orchestration:** coordinator binds identities and validates output.

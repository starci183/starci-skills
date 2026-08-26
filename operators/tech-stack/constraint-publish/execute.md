# Execute `tech-stack/constraint-publish`

## Step 1 — Bind the approved stack and compatibility receipt

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** coordinator binds identities and validates output.

## Step 2 — Verify no critical unresolved contradiction remains

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** identity, scope, or evidence drift. **Orchestration:** independent evidence slices may run in parallel and the coordinator merges only typed findings.

## Step 3 — Publish the immutable head and handoff-safe artifact receipt

**Read:** only the validated fields declared for this step. **Context:** exact refs and evidence required by the decision; do not scan adjacent source. **Session write:** step result under `payload.session.scratchPrefix`. **Stop:** do not emit success with unresolved critical contradictions. **Orchestration:** coordinator binds identities and validates output.

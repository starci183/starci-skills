# Execute `be/implementation-conformance`

Compare actual repositories, entity managers, SQL, migrations and configuration with approved contracts before lint and tests.

## Step 1 — Validate and freeze

**Read:** complete input envelope only.  
**Context:** none before `validate-input.mjs` succeeds.  
**Session write:** freeze route and refs at `payload.session.inputRef`.  
**Stop:** reject junk, foreign task refs, missing revisions or undeclared loads.

## Step 2 — Resolve minimum evidence

**Read:** declared artifacts and one knowledge binding.  
**Context:** load exact session refs plus `be.verification`; source, configuration, deployment and runtime evidence are observations, not authority.  
**Session write:** evidence and unknowns under `payload.session.scratchPrefix/evidence`.  
**Stop:** pause on stale evidence, contradictions or broadened scope.

## Step 3 — Decide and challenge

**Read:** validated evidence only.  
**Context:** apply only this capability law. Record criteria, conclusions and counter-evidence, never chain-of-thought.  
**Session write:** typed candidate at `payload.session.scratchPrefix/candidate`.  
**Stop:** Actual component, physical store, qualified resource and connection token match the approved contract and ownership matrix.

## Step 4 — Validate and emit

**Read:** candidate, evidence refs and lineage.  
**Context:** no new load. Validate against `migration/v6.1/architecture-backend/schemas/conformance.schema.json`.  
**Session write:** accepted artifact at `payload.session.outputRef`.  
**Stop:** never emit partial or invalid output. Orchestration may parallelize independent evidence comparisons; one coordinator owns decision and cleanup.

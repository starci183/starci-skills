const configs = {
  "architecture/evidence-discovery": ["source.provenance", "evidence-claim-set.schema.json", "Inventory revision-pinned requirements, configuration, source, migration, deployment, test and runtime observations; never promote source into authority.", "Every claim carries kind, claim state, revision and evidence location; unknowns remain explicit."],
  "architecture/system-model": ["architecture.decision-analysis", "system-model.schema.json", "Compile observed, target and migration component, deployable, store and communication views without collapsing them.", "Every component maps to a deployable; every physical store and read, write or migrate edge is qualified."],
  "architecture/data-ownership": ["architecture.decision-analysis", "data-ownership.schema.json", "Assign business, runtime, writer, reader, migrator, backup and restore ownership for every qualified physical resource.", "Every relational resource names database.schema.resource and its actual connection token; observed and target bindings remain separate."],
  "architecture/contradiction-analysis": ["architecture.decision-analysis", "contradiction-ledger.schema.json", "Challenge contradictions between owner intent, business authority, source, configuration, migrations, deployment and runtime evidence.", "No conflict is silently resolved by trusting source; blocking contradictions name the missing authority or decision."],
  "architecture/design-realization": ["architecture.decision-analysis", "design-realization.schema.json", "Map every approved decision to composition roots, source targets, deployables, resources, connection tokens, configuration, secrets, migrations and proof.", "No approved decision remains diagram-only; every write and deployment has an exact realization and proof path."],
  "architecture/independent-critique": ["architecture.decision-analysis", "critique.schema.json", "Independently attack the proposed architecture from fresh context, especially ownership, wrong-store, deployment and migration assumptions.", "The critic receives artifacts and counter-evidence only, never the author reasoning trace, and cannot accept open blockers."],
  "architecture/conformance": ["architecture.decision-analysis", "conformance.schema.json", "Prove implementation and deployment realize approved architecture and persistence ownership before deterministic checks.", "Actual source bindings, connection tokens, qualified resources and deployment wiring match approved artifacts."],
  "be/solution-design": ["be.demand-modeling", "backend-contract.schema.json", "Define one bounded backend solution from approved architecture, business invariants and qualified persistence ownership before source mutation.", "Responsibilities, invariants, failure semantics, compatibility and owned resources are explicit."],
  "be/mutation-contract": ["be.plan-compilation", "backend-contract.schema.json", "Specify invariants, reads, qualified writes, connection tokens, cross-boundary effects and proof cases for every state change.", "Every write matches the target writer, physical store, database.schema.resource and connection token."],
  "be/contract-critique": ["be.plan-challenge", "critique.schema.json", "Independently attack backend contracts for wrong-store access, ownership, failure, compatibility and transaction gaps.", "Fresh-context critique includes a wrong-store counterexample and never accepts lint or types as semantic proof."],
  "be/implementation-conformance": ["be.verification", "conformance.schema.json", "Compare actual repositories, entity managers, SQL, migrations and configuration with approved contracts before lint and tests.", "Actual component, physical store, qualified resource and connection token match the approved contract and ownership matrix."],
  "be/delivery-proof": ["be.delivery-proof", "conformance.schema.json", "Join semantic conformance, focused tests, contracts, migrations, rollback and deterministic receipts into a release decision.", "Semantic conformance passes before lint, tests and build; migration changes include rollback proof."]
}

const id = process.argv[2]
if (!configs[id]) throw new Error(`unknown operator ${id}`)
const [domain, name] = id.split("/")
const [knowledge, artifactSchema, purpose, gate] = configs[id]
const stage = `${domain}.v61.${name}`
const completedStage = `${stage}.complete`
const fact = `${domain}-${name}-ready`
const base = `C:\\Repositories\\ac\\starci-skills\\operators\\${id.replaceAll("/", "\\")}`
const sessionRef = { type: "string", pattern: "^session://tasks/[A-Za-z0-9._-]+/.+$" }
const sha256 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }

const inputSchema = {
  $id: `https://starci.dev/v6/operators/${id}/input.schema.json`, title: `${id} input`, $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object", additionalProperties: false, required: ["schemaVersion", "runId", "stage", "status", "facts", "payload"],
  properties: {
    schemaVersion: { const: 6 }, runId: { type: "string", minLength: 1 }, stage: { const: stage }, status: { const: "ready" },
    facts: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
    payload: { type: "object", additionalProperties: false, required: ["provided", "loads", "session"], properties: {
      provided: { type: "object", additionalProperties: false, required: ["artifactRefs"], properties: { artifactRefs: { type: "array", minItems: 1, uniqueItems: true, items: { $ref: "#/$defs/sessionRef" } } } },
      loads: { type: "object", additionalProperties: false, required: ["artifacts", "knowledge"], properties: {
        artifacts: { type: "array", minItems: 1, uniqueItems: true, items: { type: "object", additionalProperties: false, required: ["ref", "revision", "loadMode"], properties: { ref: { $ref: "#/$defs/sessionRef" }, revision: { $ref: "#/$defs/sha256" }, loadMode: { const: "session-exact" } } } },
        knowledge: { type: "array", minItems: 1, maxItems: 1, items: { type: "object", additionalProperties: false, required: ["id", "generation", "contentSha256", "loadMode"], properties: { id: { const: knowledge }, generation: { type: "string", minLength: 1 }, contentSha256: { $ref: "#/$defs/sha256" }, loadMode: { const: "qdrant-exact" } } } }
      } },
      session: { type: "object", additionalProperties: false, required: ["taskId", "inputRef", "outputRef", "scratchPrefix", "retention"], properties: { taskId: { type: "string", minLength: 1 }, inputRef: { $ref: "#/$defs/sessionRef" }, outputRef: { $ref: "#/$defs/sessionRef" }, scratchPrefix: { $ref: "#/$defs/sessionRef" }, retention: { const: "until-skill-terminal" } } }
    } }
  },
  $defs: { sha256, sessionRef }
}

const outputSchema = {
  $id: `https://starci.dev/v6/operators/${id}/output.schema.json`, title: `${id} output`, $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object", additionalProperties: false, required: ["schemaVersion", "runId", "stage", "status", "facts", "payload"],
  properties: {
    schemaVersion: { const: 6 }, runId: { type: "string", minLength: 1 }, stage: { const: completedStage }, status: { const: "ready" },
    facts: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
    payload: { type: "object", additionalProperties: false, required: ["decision", "state", "produced", "context", "cleanup", "evidenceRefs", "findings"], properties: {
      decision: { enum: ["ready", "revise", "blocked"] },
      state: { type: "object", additionalProperties: false, required: ["operator", "status", "code", "retryable", "emits"], properties: { operator: { const: id }, status: { enum: ["completed", "replan", "blocked"] }, code: { type: "string", minLength: 1 }, retryable: { type: "boolean" }, emits: { type: "object", additionalProperties: false, required: ["stage", "status", "factsAdd"], properties: { stage: { const: completedStage }, status: { const: "ready" }, factsAdd: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } } } } } },
      produced: { type: "object", additionalProperties: false, required: ["artifactRef", "artifactSchemaRef", "artifact", "durableWrites"], properties: { artifactRef: { $ref: "#/$defs/sessionRef" }, artifactSchemaRef: { const: `migration/v6.1/architecture-backend/schemas/${artifactSchema}` }, artifact: { type: "object" }, durableWrites: { type: "array", maxItems: 0 } } },
      context: { type: "object", additionalProperties: false, required: ["used"], properties: { used: { type: "array", minItems: 1, uniqueItems: true, items: { type: "object", additionalProperties: false, required: ["kind", "ref", "revision"], properties: { kind: { enum: ["session-artifact", "qdrant-knowledge", "exact-source", "exact-deployment", "business-authority"] }, ref: { type: "string", minLength: 1 }, revision: { type: "string", minLength: 1 } } } } } },
      cleanup: { type: "object", additionalProperties: false, required: ["scratchRefs", "retention", "purgeAt"], properties: { scratchRefs: { type: "array", uniqueItems: true, items: { $ref: "#/$defs/sessionRef" } }, retention: { const: "until-skill-terminal" }, purgeAt: { const: "skill-terminal" } } },
      evidenceRefs: { type: "array", minItems: 1, uniqueItems: true, items: { $ref: "#/$defs/sessionRef" } },
      findings: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } }
    } }
  },
  $defs: { sessionRef }
}

const manifest = { schemaVersion: 6, id, domain, inputSchema: "input.schema.json", outputSchema: "output.schema.json", knowledgeRefs: [knowledge], sourceReferenceRefs: [], accepts: [{ stage, status: "ready", allFacts: [], noneFacts: [] }], emits: [{ stage: completedStage, status: "ready", factsAdd: [fact], factsRemove: [] }], sideEffects: ["keep artifacts and observations in task-session memory only", "purge intermediate session objects at every parent-skill terminal state"], stopConditions: ["required evidence is missing, stale or contradictory", gate, "source observations would be treated as target authority"] }

const inputDoc = `# \`${id}\` input

${purpose}

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route | Parent state machine | Select this atomic capability. |
| \`payload.provided.artifactRefs\` | Previous state | Supply immutable session refs; source remains observation. |
| \`payload.loads.artifacts\` | Runtime | Resolve only revision-pinned refs after validation. |
| \`payload.loads.knowledge\` | Runtime | Retrieve only \`${knowledge}\`. |
| \`payload.session\` | Runtime | Own ephemeral input, output and scratch slots. |

Validation precedes every load. No undeclared source or adjacent capability context is accepted.`

const outputDoc = `# \`${id}\` output

The output is an ephemeral typed artifact governed by \`migration/v6.1/architecture-backend/schemas/${artifactSchema}\`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| \`payload.decision\` | Route \`ready\`, \`revise\`, or \`blocked\`. |
| \`payload.state\` | Expose status, code, retryability and emitted state. |
| \`payload.produced\` | Hold the typed artifact and session ref; no durable write. |
| \`payload.context.used\` | Preserve only refs and revisions actually used. |
| \`payload.cleanup\` | Purge scratch data at every \`skill-terminal\`. |
| \`payload.evidenceRefs\` | Keep inspectable evidence, never reasoning traces. |

Gate: ${gate}`

const executeDoc = `# Execute \`${id}\`

${purpose}

## Step 1 — Validate and freeze

**Read:** complete input envelope only.  
**Context:** none before \`validate-input.mjs\` succeeds.  
**Session write:** freeze route and refs at \`payload.session.inputRef\`.  
**Stop:** reject junk, foreign task refs, missing revisions or undeclared loads.

## Step 2 — Resolve minimum evidence

**Read:** declared artifacts and one knowledge binding.  
**Context:** load exact session refs plus \`${knowledge}\`; source, configuration, deployment and runtime evidence are observations, not authority.  
**Session write:** evidence and unknowns under \`payload.session.scratchPrefix/evidence\`.  
**Stop:** pause on stale evidence, contradictions or broadened scope.

## Step 3 — Decide and challenge

**Read:** validated evidence only.  
**Context:** apply only this capability law. Record criteria, conclusions and counter-evidence, never chain-of-thought.  
**Session write:** typed candidate at \`payload.session.scratchPrefix/candidate\`.  
**Stop:** ${gate}

## Step 4 — Validate and emit

**Read:** candidate, evidence refs and lineage.  
**Context:** no new load. Validate against \`migration/v6.1/architecture-backend/schemas/${artifactSchema}\`.  
**Session write:** accepted artifact at \`payload.session.outputRef\`.  
**Stop:** never emit partial or invalid output. Orchestration may parallelize independent evidence comparisons; one coordinator owns decision and cleanup.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| \`@provided-artifacts\` | \`payload.loads.artifacts\` | session | exact previous-state refs only |
| \`@knowledge-1\` | \`${knowledge}\` | qdrant | this capability's law only |`

const inputValidator = `import { runValidatorCli, validatorFor } from '../../validation.mjs';
const schemaUrl = new URL('./input.schema.json', import.meta.url);
function semantic(value) {
  const errors = [];
  const loaded = value.payload.loads.artifacts.map((item) => item.ref);
  for (const ref of value.payload.provided.artifactRefs) if (!loaded.includes(ref)) errors.push(\`/payload/loads/artifacts: missing exact binding for \${ref}\`);
  if (value.payload.loads.knowledge[0]?.id !== '${knowledge}') errors.push('/payload/loads/knowledge: exact operator knowledge required');
  const prefix = \`session://tasks/\${value.payload.session.taskId}/\`;
  for (const key of ['inputRef','outputRef','scratchPrefix']) if (!value.payload.session[key].startsWith(prefix)) errors.push(\`/payload/session/\${key}: foreign task ref\`);
  return errors;
}
export const validateInput = validatorFor(schemaUrl, semantic);
if (process.argv[1] && import.meta.url === new URL(\`file:///\${process.argv[1].replaceAll('\\\\', '/')}\`).href) await runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>');`

const outputValidator = `import { runValidatorCli, validatorFor } from '../../validation.mjs';
const schemaUrl = new URL('./output.schema.json', import.meta.url);
function semantic(value) {
  const errors = [];
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: route drift');
  if (!value.facts.includes('${fact}')) errors.push('/facts: capability fact missing');
  if (value.payload.produced.durableWrites.length) errors.push('/payload/produced/durableWrites: analysis operator is read-only');
  return errors;
}
export const validateOutput = validatorFor(schemaUrl, semantic);
if (process.argv[1] && import.meta.url === new URL(\`file:///\${process.argv[1].replaceAll('\\\\', '/')}\`).href) await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');`

const files = {
  "operator.json": JSON.stringify(manifest, null, 2),
  "input.schema.json": JSON.stringify(inputSchema, null, 2),
  "output.schema.json": JSON.stringify(outputSchema, null, 2),
  "input.md": inputDoc,
  "output.md": outputDoc,
  "execute.md": executeDoc,
  "validate-input.mjs": inputValidator,
  "validate-output.mjs": outputValidator
}

const add = (file, content) => `*** Add File: ${base}\\${file}\n${content.split("\n").map((line) => `+${line}`).join("\n")}\n`
process.stdout.write(`*** Begin Patch\n${Object.entries(files).map(([file, content]) => add(file, content)).join("")}*** End Patch\n`)

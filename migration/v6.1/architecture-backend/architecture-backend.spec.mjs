import test from "node:test"
import assert from "node:assert/strict"
import {
  validateBackendContract,
  validateConformance,
  validateOwnershipMatrix
} from "./validate-artifact.mjs"

const evidence = ["source:nivo@abc:src/app.module.ts:1"]
const systemModel = {
  stores: [
    { id: "postgres-primary", technology: "postgresql" },
    { id: "postgres-agentos", technology: "postgresql" }
  ]
}

function actor(componentRef = "agentos-controlplane", connectionToken = "POSTGRESQL_AGENTOS") {
  return { componentRef, operations: ["insert", "update"], accessPath: "entity-manager", connectionToken, evidenceRefs: evidence }
}

function authority(componentRef = "agentos-controlplane", mechanism = "migration", versionRef = "agentos-ddl@1") {
  return { componentRef, mechanism, versionRef, evidenceRefs: evidence }
}

function resource(overrides = {}) {
  const binding = {
    storeRef: "postgres-agentos",
    database: "agentos",
    namespace: "public",
    qualifiedName: "agentos.public.jobs",
    connectionToken: "POSTGRESQL_AGENTOS"
  }
  return {
    resourceId: "agentos.jobs",
    businessOwner: "agentos",
    runtimeOwner: "agentos-controlplane",
    sourceOfTruth: true,
    tenantBoundary: { mode: "per-instance", tenantKey: "instance_id" },
    observedBinding: binding,
    targetBinding: binding,
    transitionRef: null,
    writers: [actor()],
    readers: [],
    schemaAuthorities: [authority()],
    transactionBoundary: "agentos-postgres-local",
    backupOwner: "platform-ops",
    restoreOwner: "platform-ops",
    claimState: "target",
    evidenceRefs: evidence,
    ...overrides
  }
}

function matrix(value = resource()) {
  return { matrixId: "nivo-ownership", resources: [value], evidenceRefs: evidence }
}

function write(storeRef, qualifiedName, connectionToken) {
  return {
    resourceRef: "agentos.jobs",
    storeRef,
    qualifiedName,
    accessPath: "entity-manager",
    connectionToken,
    componentRef: "agentos-controlplane"
  }
}

function bundle(writeAccess) {
  return {
    mutationContracts: [{
      operationId: "create-job",
      owningComponent: "agentos-controlplane",
      reads: [],
      writes: [writeAccess]
    }],
    queryContracts: [],
    transactionContracts: [{ transactionId: "create-job-tx", storeRefs: [writeAccess.storeRef], mode: "local-acid" }]
  }
}

test("Nivo wrong-primary DB: a mutation contract cannot follow the observed central binding after AgentOS ownership moves", () => {
  const observedPrimary = {
    storeRef: "postgres-primary",
    database: "nivo",
    namespace: "public",
    qualifiedName: "nivo.public.jobs",
    connectionToken: "POSTGRESQL_PRIMARY"
  }
  const ownership = matrix(resource({
    observedBinding: observedPrimary,
    transitionRef: "migration:agentos-primary-to-agentos-db",
    claimState: "migration"
  }))
  const contract = bundle(write("postgres-primary", "nivo.public.jobs", "POSTGRESQL_PRIMARY"))

  const report = validateBackendContract(contract, ownership)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === "CONTRACT_WRONG_STORE"))
  assert.ok(report.errors.some(({ code }) => code === "CONTRACT_CONNECTION_TOKEN_MISMATCH"))
})

test("unqualified jobs table: a relational ownership artifact must name database.schema.resource", () => {
  const badBinding = {
    storeRef: "postgres-agentos",
    database: "agentos",
    namespace: "public",
    qualifiedName: "jobs",
    connectionToken: "POSTGRESQL_AGENTOS"
  }
  const report = validateOwnershipMatrix(matrix(resource({ observedBinding: badBinding, targetBinding: badBinding })), systemModel)

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === "PERSISTENCE_IDENTITY_UNQUALIFIED"))
})

test("dual writer and migrator: independent components cannot silently share writes or divergent DDL", () => {
  const ownership = matrix(resource({
    writers: [actor(), actor("agentos-cli")],
    schemaAuthorities: [
      authority("agentos-controlplane", "migration", "controlplane-ddl@12"),
      authority("agentos-cli", "migration", "cli-ddl@9")
    ]
  }))
  const report = validateOwnershipMatrix(ownership, systemModel)

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === "OWNERSHIP_MULTIPLE_WRITERS"))
  assert.ok(report.errors.some(({ code }) => code === "SCHEMA_AUTHORITY_CONFLICT"))
})

test("lint-green wrong-store: deterministic checks cannot override semantic conformance", () => {
  const ownership = matrix()
  const contract = bundle(write("postgres-agentos", "agentos.public.jobs", "POSTGRESQL_AGENTOS"))
  const conformance = {
    decision: "conformant",
    accesses: [{
      componentRef: "agentos-controlplane",
      operation: "write",
      resourceRef: "agentos.jobs",
      storeRef: "postgres-primary",
      qualifiedName: "nivo.public.jobs",
      connectionToken: "POSTGRESQL_PRIMARY",
      sourceRef: "src/jobs/jobs.service.ts:42"
    }],
    semanticChecks: [{ checkId: "ownership", status: "pass", evidenceRefs: evidence }],
    deterministicChecks: [
      { checkId: "lint", status: "pass", evidenceRefs: ["receipt:lint"] },
      { checkId: "unit-test", status: "pass", evidenceRefs: ["receipt:test"] }
    ]
  }

  const report = validateConformance(conformance, ownership, contract)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(({ code }) => code === "IMPLEMENTATION_WRONG_STORE"))
  assert.ok(report.errors.some(({ code }) => code === "CONFORMANCE_DECISION_FALSE_POSITIVE"))
})

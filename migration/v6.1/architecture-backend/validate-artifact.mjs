const DIRECT_ACCESS = new Set(["repository", "entity-manager", "sql"])

const result = (errors) => ({ valid: errors.length === 0, errors })
const issue = (errors, code, path, message) => errors.push({ code, path, message })
const sameBinding = (a = {}, b = {}) =>
  ["storeRef", "database", "namespace", "qualifiedName", "connectionToken"].every((key) => a[key] === b[key])

function validateRelationalBinding(binding, path, errors) {
  const segments = String(binding?.qualifiedName ?? "").split(".").filter(Boolean)
  if (!binding?.database || !binding?.namespace || segments.length < 3) {
    issue(errors, "PERSISTENCE_IDENTITY_UNQUALIFIED", path, "Relational resources require database.namespace.resource.")
    return
  }
  if (segments[0] !== binding.database || segments[1] !== binding.namespace) {
    issue(errors, "PERSISTENCE_IDENTITY_MISMATCH", path, "qualifiedName must begin with the declared database and namespace.")
  }
}

export function validateSystemModel(model) {
  const errors = []
  const components = new Set((model?.components ?? []).map(({ id }) => id))
  const stores = new Map((model?.stores ?? []).map((store) => [store.id, store]))

  for (const [index, store] of (model?.stores ?? []).entries()) {
    const path = `stores[${index}]`
    if (["postgresql", "mysql", "mongodb"].includes(store.technology) && (!store.database || !store.namespace)) {
      issue(errors, "STORE_DATABASE_NAMESPACE_REQUIRED", path, `${store.technology} requires database and namespace.`)
    }
    if (store.technology === "qdrant" && !store.collection) issue(errors, "STORE_COLLECTION_REQUIRED", path, "Qdrant requires a collection.")
    if (["s3", "minio"].includes(store.technology) && !store.bucket) issue(errors, "STORE_BUCKET_REQUIRED", path, `${store.technology} requires a bucket.`)
    if (store.technology === "kafka" && !store.queue) issue(errors, "STORE_QUEUE_REQUIRED", path, "Kafka requires a topic/queue resource.")
  }

  for (const [index, edge] of (model?.edges ?? []).entries()) {
    const path = `edges[${index}]`
    if (!components.has(edge.from) && !stores.has(edge.from)) issue(errors, "EDGE_FROM_UNKNOWN", path, `Unknown endpoint ${edge.from}.`)
    if (!components.has(edge.to) && !stores.has(edge.to)) issue(errors, "EDGE_TO_UNKNOWN", path, `Unknown endpoint ${edge.to}.`)
    if (["read", "write", "migrate"].includes(edge.kind) && !(edge.resourceRefs ?? []).length) issue(errors, "EDGE_RESOURCE_REQUIRED", path, `${edge.kind} edges require resourceRefs.`)
    if (["write", "migrate"].includes(edge.kind) && !edge.connectionToken) issue(errors, "EDGE_CONNECTION_TOKEN_REQUIRED", path, `${edge.kind} edges require the runtime connection token.`)
  }
  return result(errors)
}

export function validateOwnershipMatrix(matrix, systemModel = {}) {
  const errors = []
  const stores = new Map((systemModel?.stores ?? []).map((store) => [store.id, store]))

  for (const [index, resource] of (matrix?.resources ?? []).entries()) {
    const path = `resources[${index}]`
    const targetStore = stores.get(resource?.targetBinding?.storeRef)
    const relational = !targetStore || ["postgresql", "mysql", "mongodb"].includes(targetStore.technology)
    if (relational) {
      validateRelationalBinding(resource?.observedBinding, `${path}.observedBinding`, errors)
      validateRelationalBinding(resource?.targetBinding, `${path}.targetBinding`, errors)
    }
    if (!sameBinding(resource.observedBinding, resource.targetBinding) && !resource.transitionRef) {
      issue(errors, "OWNERSHIP_TRANSITION_REQUIRED", path, "Observed and target bindings differ; a migration transitionRef is mandatory.")
    }
    if (!sameBinding(resource.observedBinding, resource.targetBinding) && !["migration", "contradicted"].includes(resource.claimState)) {
      issue(errors, "OWNERSHIP_TRANSITION_STATE_INVALID", path, "A changed binding must be labelled migration or contradicted.")
    }

    const writerComponents = new Set()
    for (const [writerIndex, writer] of (resource.writers ?? []).entries()) {
      writerComponents.add(writer.componentRef)
      if (DIRECT_ACCESS.has(writer.accessPath) && !writer.connectionToken) issue(errors, "WRITER_CONNECTION_TOKEN_REQUIRED", `${path}.writers[${writerIndex}]`, "Direct writers require a connection token.")
      if (DIRECT_ACCESS.has(writer.accessPath) && writer.connectionToken !== resource.targetBinding?.connectionToken) {
        issue(errors, "WRITER_CONNECTION_TOKEN_MISMATCH", `${path}.writers[${writerIndex}]`, "Writer token does not select the target physical store.")
      }
    }
    if (writerComponents.size > 1) issue(errors, "OWNERSHIP_MULTIPLE_WRITERS", `${path}.writers`, "More than one component writes this resource; replace with one owner or an explicit service/event boundary.")

    const authorities = resource.schemaAuthorities ?? []
    if (authorities.length > 1) {
      const shared = authorities.every(({ mechanism }) => ["shared-migration", "shared-ddl"].includes(mechanism))
      const versions = new Set(authorities.map(({ versionRef }) => versionRef))
      if (!shared || versions.size !== 1) issue(errors, "SCHEMA_AUTHORITY_CONFLICT", `${path}.schemaAuthorities`, "Multiple migrators require one shared artifact and identical versionRef.")
    }
  }
  return result(errors)
}

export function validateBackendContract(bundle, ownershipMatrix) {
  const errors = []
  const resources = new Map((ownershipMatrix?.resources ?? []).map((resource) => [resource.resourceId, resource]))
  const validateAccess = (access, path, mode, owningComponent) => {
    const owned = resources.get(access.resourceRef)
    if (!owned) return issue(errors, "CONTRACT_RESOURCE_UNKNOWN", path, `Unknown resource ${access.resourceRef}.`)
    validateRelationalBinding({ ...owned.targetBinding, qualifiedName: access.qualifiedName }, path, errors)
    if (access.storeRef !== owned.targetBinding.storeRef || access.qualifiedName !== owned.targetBinding.qualifiedName) {
      issue(errors, "CONTRACT_WRONG_STORE", path, "Contract store or qualified resource differs from target ownership.")
    }
    if (DIRECT_ACCESS.has(access.accessPath) && access.connectionToken !== owned.targetBinding.connectionToken) {
      issue(errors, "CONTRACT_CONNECTION_TOKEN_MISMATCH", path, "Contract connection token differs from target ownership.")
    }
    if (mode === "write" && !(owned.writers ?? []).some(({ componentRef }) => componentRef === owningComponent)) {
      issue(errors, "CONTRACT_WRITER_UNAUTHORIZED", path, `${owningComponent} is not an authorized writer.`)
    }
  }

  for (const [mutationIndex, mutation] of (bundle?.mutationContracts ?? []).entries()) {
    for (const [index, access] of (mutation.reads ?? []).entries()) validateAccess(access, `mutationContracts[${mutationIndex}].reads[${index}]`, "read", mutation.owningComponent)
    for (const [index, access] of (mutation.writes ?? []).entries()) validateAccess(access, `mutationContracts[${mutationIndex}].writes[${index}]`, "write", mutation.owningComponent)
  }
  for (const [queryIndex, query] of (bundle?.queryContracts ?? []).entries()) {
    for (const [index, access] of (query.reads ?? []).entries()) validateAccess(access, `queryContracts[${queryIndex}].reads[${index}]`, "read", query.owningComponent)
  }
  for (const [index, transaction] of (bundle?.transactionContracts ?? []).entries()) {
    if (transaction.mode === "local-acid" && new Set(transaction.storeRefs ?? []).size > 1) {
      issue(errors, "TRANSACTION_CROSSES_STORES", `transactionContracts[${index}]`, "local-acid is valid only inside one physical store.")
    }
  }
  return result(errors)
}

export function validateCritique(critique) {
  const errors = []
  if (!critique?.independence?.freshContext || !critique?.independence?.authorExcluded || !critique?.independence?.assumptionsHidden) {
    issue(errors, "CRITIQUE_NOT_INDEPENDENT", "independence", "Critique must use fresh context without author trace or assumptions.")
  }
  const blocking = (critique?.challenges ?? []).filter(({ severity, status }) => severity === "blocking" && status === "open")
  if (blocking.length && critique?.decision === "accept") issue(errors, "CRITIQUE_BLOCKER_ACCEPTED", "decision", "Open blocking challenges prohibit acceptance.")
  return result(errors)
}

export function validateConformance(report, ownershipMatrix, backendBundle) {
  const errors = []
  const resources = new Map((ownershipMatrix?.resources ?? []).map((resource) => [resource.resourceId, resource]))
  const contractWrites = new Set()
  for (const mutation of (backendBundle?.mutationContracts ?? [])) {
    for (const write of (mutation.writes ?? [])) contractWrites.add([mutation.owningComponent, write.resourceRef, write.storeRef, write.qualifiedName, write.connectionToken].join("|"))
  }

  for (const [index, access] of (report?.accesses ?? []).entries()) {
    if (!["write", "migrate"].includes(access.operation)) continue
    const path = `accesses[${index}]`
    const owned = resources.get(access.resourceRef)
    if (!owned) {
      issue(errors, "IMPLEMENTATION_RESOURCE_UNKNOWN", path, `Unknown resource ${access.resourceRef}.`)
      continue
    }
    if (access.storeRef !== owned.targetBinding.storeRef || access.qualifiedName !== owned.targetBinding.qualifiedName || access.connectionToken !== owned.targetBinding.connectionToken) {
      issue(errors, "IMPLEMENTATION_WRONG_STORE", path, "Actual access does not use the approved physical store, qualified resource and connection token.")
    }
    if (access.operation === "write") {
      const key = [access.componentRef, access.resourceRef, access.storeRef, access.qualifiedName, access.connectionToken].join("|")
      if (!contractWrites.has(key)) issue(errors, "IMPLEMENTATION_CONTRACT_DRIFT", path, "Actual write has no exact approved mutation contract.")
    }
  }
  const reportedSemanticFailure = (report?.semanticChecks ?? []).some(({ status }) => status === "fail")
  if (reportedSemanticFailure) issue(errors, "REPORTED_SEMANTIC_FAILURE", "semanticChecks", "A semantic conformance check failed.")
  if (errors.length && report?.decision === "conformant") issue(errors, "CONFORMANCE_DECISION_FALSE_POSITIVE", "decision", "A conformant decision cannot coexist with semantic failures, even when lint/tests pass.")
  return result(errors)
}

export function validateAll({ systemModel, ownershipMatrix, backendBundle, critique, conformance }) {
  const reports = {
    systemModel: validateSystemModel(systemModel),
    ownershipMatrix: validateOwnershipMatrix(ownershipMatrix, systemModel),
    backendBundle: validateBackendContract(backendBundle, ownershipMatrix),
    critique: validateCritique(critique),
    conformance: validateConformance(conformance, ownershipMatrix, backendBundle)
  }
  return { valid: Object.values(reports).every(({ valid }) => valid), reports }
}

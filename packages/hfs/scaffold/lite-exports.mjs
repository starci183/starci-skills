import fs from "node:fs"
import path from "node:path"
import { ScaffoldError } from "./service.mjs"

const REGISTRATIONS = Object.freeze({
  api: [
    {
      file: "be/src/modules/domain/identity/index.ts",
      source: "./identity.decorators",
      names: ["CurrentPrincipal"],
    },
    {
      file: "be/src/modules/platform/cqrs/index.ts",
      source: "./cqrs.contracts",
      names: ["ExecuteParams"],
      type: true,
    },
    {
      file: "be/src/modules/platform/cqrs/index.ts",
      source: "./cqrs.decorators",
      names: ["InjectCommandBus"],
    },
  ],
  table: [
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./database.sql",
      names: ["requireOwnedRow", "sql"],
      beforeSource: "./errors/database.error",
    },
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./primary.decorators",
      names: ["InjectPrimaryEntityManager"],
    },
  ],
  webhook: [
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./database.sql",
      names: ["sql"],
      beforeSource: "./errors/database.error",
    },
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./primary.decorators",
      names: ["InjectPrimaryEntityManager"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./http-security.config",
      names: ["parseWebhookProviderConfig"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./http-security.decorators",
      names: ["InjectWebhookSignature"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./rate-limit.guard",
      names: ["RateLimit", "RateTier"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./webhook-signature.service",
      names: ["WebhookSignatureService"],
    },
  ],
  "webhook-full": [
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./http-security.config",
      names: ["parseWebhookProviderConfig"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./http-security.decorators",
      names: ["InjectWebhookSignature"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./rate-limit.guard",
      names: ["RateLimit", "RateTier"],
    },
    {
      file: "be/src/modules/platform/http-security/index.ts",
      source: "./webhook-signature.service",
      names: ["WebhookSignatureService"],
    },
  ],
  cli: [
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./migration-runner.service",
      names: ["MigrationRunnerService"],
      beforeSource: "./database.options",
    },
    {
      file: "be/src/modules/platform/database/index.ts",
      source: "./seed-runner.service",
      names: ["SeedRunnerService"],
      beforeSource: "./database.options",
    },
  ],
})

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Every file below a folder (absolute paths); none when the folder is absent. */
export const filesBelow = (folder) => {
  const files = []
  const visit = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const target = path.join(at, entry.name)
      if (entry.isDirectory()) visit(target)
      else files.push(target)
    }
  }
  if (fs.existsSync(folder)) visit(folder)
  return files
}

function addExport(text, registration) {
  const kind = registration.type === true ? "export type" : "export"
  const line = new RegExp(`^${kind} \\{ ([^}]*) \\} from "${escape(registration.source)}"$`, "m")
  const found = line.exec(text)
  if (found) {
    const names = [...new Set([...found[1].split(",").map((name) => name.trim()), ...registration.names])].sort()
    return text.replace(line, `${kind} { ${names.join(", ")} } from "${registration.source}"`)
  }
  const added = `${kind} { ${registration.names.join(", ")} } from "${registration.source}"`
  if (registration.beforeSource) {
    const before = new RegExp(`^export(?: type)? \\{ [^}]* \\} from "${escape(registration.beforeSource)}"$`, "m")
    if (before.test(text)) return text.replace(before, `${added}\n$&`)
  }
  return `${text.replace(/\n+$/, "")}\n${added}\n`
}

/** Adds only the barrel exports first consumed by one generator; full webhooks share the same optional platform API. */
export function registerLiteExports({ root, generator }) {
  const registrations = REGISTRATIONS[generator]
  if (!registrations) throw new ScaffoldError("HFS_ADD_EXPORTS_UNKNOWN", `no export registration exists for ${generator}`)
  const byFile = new Map()
  for (const registration of registrations) {
    const list = byFile.get(registration.file) ?? []
    list.push(registration)
    byFile.set(registration.file, list)
  }
  const changed = []
  for (const [relative, entries] of byFile) {
    const file = path.join(root, ...relative.split("/"))
    if (!fs.existsSync(file)) {
      throw new ScaffoldError("HFS_ADD_EXPORTS_MISSING", `${generator} needs the scaffolded barrel ${relative}`)
    }
    const before = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")
    const after = entries.reduce(addExport, before)
    if (after !== before) {
      fs.writeFileSync(file, after)
      changed.push(relative)
    }
  }
  return changed
}

/** Makes a domain service public only when a generated transport first imports its module barrel. */
export function registerLiteDomainService({ root, moduleSpecifier, service }) {
  const prefix = "@modules/domain/"
  if (!moduleSpecifier.startsWith(prefix)) return null
  const owner = path.join(root, "be", "src", "modules", "domain", ...moduleSpecifier.slice(prefix.length).split("/"))
  const index = path.join(owner, "index.ts")
  if (!fs.existsSync(index)) {
    throw new ScaffoldError("HFS_ADD_EXPORTS_MISSING", `the generated transport needs the domain barrel ${moduleSpecifier}/index.ts`)
  }
  const candidates = filesBelow(owner).filter(
    (file) => file.endsWith(".service.ts") && new RegExp(`\\bexport\\s+class\\s+${escape(service)}\\b`).test(fs.readFileSync(file, "utf8")),
  )
  if (candidates.length !== 1) {
    throw new ScaffoldError("HFS_ADD_EXPORTS_SERVICE", `${moduleSpecifier} must contain exactly one exported ${service} in a .service.ts file`)
  }
  const before = fs.readFileSync(index, "utf8").replace(/\r\n/g, "\n")
  if (new RegExp(`\\b${escape(service)}\\b`).test(before)) return null
  const source = `./${path.relative(owner, candidates[0]).replaceAll("\\", "/").replace(/\.ts$/, "")}`
  fs.writeFileSync(index, `${before.replace(/\n+$/, "")}\nexport { ${service} } from "${source}"\n`)
  return path.relative(root, index).replaceAll("\\", "/")
}

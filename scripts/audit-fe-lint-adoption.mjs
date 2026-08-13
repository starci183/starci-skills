/** Audit a consuming repository's effective ESLint config against the complete StarCi FE canon. */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { auditLintAdoption } from "../sources/fe/lint-adoption.mjs"
import { recommended } from "../sources/fe/index.mjs"

const argument = (name) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const target = argument("--target")
const probe = argument("--probe")

if (target === undefined || probe === undefined) {
  process.stderr.write(
    "usage: node audit-fe-lint-adoption.mjs --target <repository-root> --probe <production-file>\n",
  )
  process.exitCode = 2
} else {
  const eslint = resolve(target, "node_modules", "eslint", "bin", "eslint.js")
  if (!existsSync(eslint)) {
    process.stderr.write(`target has no installed ESLint executable: ${eslint}\n`)
    process.exitCode = 2
  } else {
    const printed = spawnSync(process.execPath, [eslint, "--print-config", probe], {
      cwd: target,
      encoding: "utf8",
    })

    if (printed.status !== 0) {
      process.stderr.write(
        printed.stderr || printed.stdout || printed.error?.message || "eslint --print-config failed\n",
      )
      process.exitCode = printed.status ?? 1
    } else {
      const result = auditLintAdoption(JSON.parse(printed.stdout), recommended)
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      if (!result.ok) process.exitCode = 1
    }
  }
}

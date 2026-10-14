// codegen.mjs - the app's generated code, the one step behind `npm run codegen` (lint, typecheck, dev and build run it first).
// The front end reads the back end's committed contracts in place (be/contracts/) and generates its client from them into a
// gitignored __generated__/ folder.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

// GraphQL wire types, the same in both editions (owner ruling 2026-10-13): every fe app with operations under
// src/modules/api/graphql/{queries,mutations} gets its typed documents generated from the contract snapshots the back end emits
// (be/contracts/<app>/schema.graphql, `npm run contract:emit`) into the gitignored src/modules/api/graphql/__generated__/.
// The shop calls two services (identity and order); their snapshots are merged into one schema, whose root types each
// service extends with its own fields. Nothing to generate (no snapshot yet, or no fe app with a modules/api/graphql folder)
// is not an error.
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."))
const CONTRACTS = path.join("be", "contracts")
const FE_APPS = path.join("fe", "apps")
const posix = (file) => file.split(path.sep).join("/")
const byCodeUnit = (left, right) => {
    if (left === right) return 0
    return left < right ? -1 : 1
}
const schemas = (fs.existsSync(CONTRACTS) ? fs.readdirSync(CONTRACTS) : [])
    .map((app) => path.join(CONTRACTS, app, "schema.graphql"))
    .filter((file) => fs.existsSync(file))
    .sort(byCodeUnit)
    .map(posix)
const operationRoots = (fs.existsSync(FE_APPS) ? fs.readdirSync(FE_APPS) : [])
    .map((app) => path.join(FE_APPS, app, "src", "modules", "api", "graphql"))
    .filter((dir) => fs.existsSync(dir))
    .sort(byCodeUnit)
    .map(posix)
if (schemas.length === 0 || operationRoots.length === 0) {
    process.stdout.write("codegen: no GraphQL contract under be/contracts yet\n")
} else {
    const { generate } = await import("@graphql-codegen/cli")
    const generates = Object.fromEntries(
        operationRoots.map((root) => [
            `${root}/__generated__/`,
            {
                preset: "client",
                documents: [`${root}/queries/*.ts`, `${root}/mutations/*.ts`],
                presetConfig: { fragmentMasking: false },
                config: { useTypeImports: true, enumsAsTypes: true, avoidOptionals: true },
            },
        ]),
    )
    await generate({ schema: schemas, generates, ignoreNoDocuments: true, silent: true }, true)
    const hash = createHash("sha256")
    for (const schema of schemas) {
        const source = fs.readFileSync(schema, "utf8").replaceAll("\r\n", "\n")
        hash.update(`${schema}\0${source}\0`)
    }
    const digest = hash.digest("hex")
    for (const root of operationRoots) {
        const generated = `${root}/__generated__`
        if (fs.existsSync(generated)) fs.writeFileSync(`${generated}/.schema-sha256`, `${digest}\n`)
    }
}

// Decrypts every DEMO-ONLY .enc secret this example ships under .starcistacks/dev/runtime/**, then runs
// the given command. The decrypted files are never committed (see the backend's .gitignore); the identity
// they are encrypted to is untracked and documented as demo-only in runtime/env/KEYS.md.
//
// Usage: node scripts/with-dev-secrets.mjs <command...>
//   e.g. node scripts/with-dev-secrets.mjs docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const envDir = path.join(root, ".starcistacks", "dev", "runtime", "env")
const filesDir = path.join(root, ".starcistacks", "dev", "runtime", "files")
const keyFile = path.join(envDir, "demo.agekey")
const command = process.argv.slice(2)

if (command.length === 0) {
    process.stderr.write("usage: node scripts/with-dev-secrets.mjs <command...>\n")
    process.exit(2)
}

const hasLocalSops = spawnSync("sops", ["--version"], { stdio: "ignore" }).status === 0

/** Runs sops locally, or through the pinned container image when the binary is not installed. */
function sops(args) {
    const [bin, argv] = hasLocalSops
        ? ["sops", args]
        : ["docker", ["run", "--rm", "-e", "SOPS_AGE_KEY_FILE=/keys/key.txt", "-v", `${keyFile}:/keys/key.txt:ro`, "-v", `${root}:/work`, "-w", "/work", "ghcr.io/getsops/sops:v3.10.2", ...args]]
    const result = spawnSync(bin, argv, { encoding: "utf8", env: { ...process.env, SOPS_AGE_KEY_FILE: keyFile }, maxBuffer: 16 * 1024 * 1024 })
    if (result.status !== 0) {
        process.stderr.write(result.stderr ?? "")
        process.exit(result.status ?? 1)
    }
    return result.stdout
}

// app.env.enc is a SOPS dotenv document: decrypt it back to dotenv shape.
fs.writeFileSync(path.join(envDir, "app.env"), sops(["-d", "--input-type", "dotenv", "--output-type", "dotenv", path.join(envDir, "app.env.enc")]))

// Every *.key.enc is a single value wrapped as {"data": "..."} so SOPS has a document to encrypt; unwrap
// it back to the raw value the compose secret/file expects.
for (const name of fs.existsSync(filesDir) ? fs.readdirSync(filesDir) : []) {
    if (!name.endsWith(".key.enc")) continue
    const wrapped = sops(["-d", "--input-type", "json", "--output-type", "json", path.join(filesDir, name)])
    fs.writeFileSync(path.join(filesDir, name.slice(0, -".enc".length)), JSON.parse(wrapped).data)
}

process.stderr.write(`Decrypted dev secrets under .starcistacks/dev/runtime/**; running: ${command.join(" ")}\n`)
const child = spawnSync(command[0], command.slice(1), { stdio: "inherit" })
process.exit(child.status ?? 1)

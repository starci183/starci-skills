import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"

const scriptsRoot = dirname(fileURLToPath(import.meta.url))
const publisher = resolve(scriptsRoot, "publish-secret.mjs")
const fixture = mkdtempSync(join(tmpdir(), "starci-publish-secret-"))
const secret = `not-a-real-secret-${randomUUID()}`

try {
    writeFileSync(join(fixture, "package.json"), JSON.stringify({
        private: true,
        scripts: { "secret:set": "node sink.mjs" },
    }))
    writeFileSync(join(fixture, "sink.mjs"), `
let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
    if (input !== process.env.PUBLISH_SECRET_TEST_TOKEN) process.exit(41)
    if (process.argv[2] !== "dev/runtime/files/test-token.key") process.exit(42)
})
`)

    const result = spawnSync(process.execPath, [
        publisher,
        "--name", "TEST_TOKEN",
        "--from-env", "PUBLISH_SECRET_TEST_TOKEN",
        "--stack", `${fixture}::dev/runtime/files/test-token.key`,
    ], {
        encoding: "utf8",
        env: { ...process.env, PUBLISH_SECRET_TEST_TOKEN: secret },
    })
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    if (result.status !== 0) throw new Error(`publisher exited ${result.status}\n${output}`)
    if (output.includes(secret)) throw new Error("publisher exposed the supplied value")
    if (!output.includes("ok: .stacks/dev/runtime/files/test-token.key.enc")) {
        throw new Error(`publisher did not complete the stack projection\n${output}`)
    }
    console.log("publish-secret regression: pass")
} finally {
    rmSync(fixture, { recursive: true, force: true })
}

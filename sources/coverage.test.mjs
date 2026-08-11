/**
 * The gate that stops a rule from LOOKING enforced.
 *
 *   node --test coverage.test.mjs
 *
 * Counting `valid:` and `invalid:` in a twin proves nothing: a module with one tested rule and five
 * untested ones scores exactly what a complete one scores. This imports every law module, reads the
 * rules it publishes and the messageIds each one can emit, and demands that every single id be
 * asserted somewhere. An id nothing asserts is a branch of a rule that has never run once - which is
 * the same shape as `noUnknownSlotRole`, a rule that would have thrown on the first node it saw and
 * was found only when somebody went looking.
 *
 * WHY IT ALSO POLICES THE LEVEL. A rule shipped `off` is indistinguishable from a rule nobody
 * trusts, and reading the module to find out costs the reader the thing the level was supposed to
 * tell them. `off` is allowed - some rules genuinely cannot run without an option a repository has
 * to supply - but the reason goes on the LINE, beside the level, exactly as the debt counts do.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const AXES = ["fe", "be"]

/** Every law module, paired with its twin's source text and its own. */
const modules = async () => {
    const found = []
    for (const axis of AXES) {
        const dir = join(HERE, axis)
        const names = readdirSync(dir).filter(
            (f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs") && f !== "index.mjs",
        )
        for (const file of names) {
            const name = file.replace(/\.mjs$/, "")
            let twin = ""
            try {
                twin = readFileSync(join(dir, `${name}.test.mjs`), "utf8")
            } catch {
                twin = ""
            }
            found.push({
                axis,
                name,
                twin,
                own: readFileSync(join(dir, file), "utf8"),
                module: await import(pathToFileURL(join(dir, file)).href),
            })
        }
    }
    return found
}

test("every law module has a twin that actually runs its rules", async () => {
    const gaps = []
    for (const { axis, name, twin, module } of await modules()) {
        if (!twin) {
            gaps.push(`${axis}/${name}: no twin test`)
            continue
        }
        for (const key of Object.keys(module.rules ?? {})) {
            if (!twin.includes(`tester.run("${key}"`)) gaps.push(`${axis}/${name} :: ${key} never reaches tester.run`)
        }
    }
    assert.deepStrictEqual(gaps, [], `rules with no twin exercising them: ${gaps.join("; ")}`)
})

test("every messageId a rule can emit is asserted by its twin", async () => {
    const silent = []
    for (const { axis, name, twin, module } of await modules()) {
        for (const [key, rule] of Object.entries(module.rules ?? {})) {
            const ids = Object.keys(rule.meta?.messages ?? {})
            if (ids.length === 0) silent.push(`${axis}/${name} :: ${key} declares no messageId`)
            for (const id of ids) {
                if (!new RegExp(String.raw`messageId:\s*"${id}"`).test(twin)) {
                    silent.push(`${axis}/${name} :: ${key} :: "${id}"`)
                }
            }
        }
    }
    assert.deepStrictEqual(silent, [], `messageIds nothing asserts: ${silent.join("; ")}`)
})

test("every rule declares a level, and an off one says why on its own line", async () => {
    const unlevelled = []
    for (const { axis, name, own, module } of await modules()) {
        for (const key of Object.keys(module.rules ?? {})) {
            const level = module.recommended?.[`starci-${axis}/${key}`]
            if (level === "error" || level === "warn") continue
            if (level !== "off") {
                unlevelled.push(`${axis}/${name} :: ${key} has no level (${String(level)})`)
                continue
            }
            const line = own.split("\n").find((l) => l.includes(`"starci-${axis}/${key}"`) && l.includes('"off"'))
            if (!line || !line.includes("//")) unlevelled.push(`${axis}/${name} :: ${key} is off with no reason beside it`)
        }
    }
    assert.deepStrictEqual(unlevelled, [], `rules whose level teaches nothing: ${unlevelled.join("; ")}`)
})

test("every rule states a schema, so an unknown option cannot pass silently", async () => {
    const loose = []
    for (const { axis, name, module } of await modules()) {
        for (const [key, rule] of Object.entries(module.rules ?? {})) {
            if (!Array.isArray(rule.meta?.schema)) loose.push(`${axis}/${name} :: ${key}`)
        }
    }
    assert.deepStrictEqual(loose, [], `rules with no meta.schema: ${loose.join("; ")}`)
})

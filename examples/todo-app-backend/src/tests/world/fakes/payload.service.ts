/**
 * Loads the payload fixtures of the fakes: `fakes/<provider>/payloads/<name>.json`, the bodies a provider answers or sends,
 * with `{{key}}` placeholders for the values that vary per call. The same files feed the fake servers and the live
 * (sandbox) specs, which compare their shape with the answers of the real provider.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const escapeForJson = (value: string): string => JSON.stringify(value).slice(1, -1)

/** The fixture `name` of `provider` with every `{{key}}` replaced by its value, parsed. */
export const renderPayload = (provider: string, name: string, values: Readonly<Record<string, string>> = {}): unknown => {
    const raw = readFileSync(join(__dirname, provider, "payloads", `${name}.json`), "utf8")
    const filled = Object.entries(values).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(escapeForJson(value)), raw)
    return JSON.parse(filled)
}

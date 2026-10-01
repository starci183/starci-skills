import { TestWorldErrorCode, worldError } from "../../errors"
import { NAMESPACE_LABEL } from "./config"
import type { Kubectl } from "./kubectl"
import { pollUntil, realClock } from "./poll"
import type { Clock } from "./poll"

/** The label value of a namespace prefix (`nivo-x-1a2b3c-` gives `nivo-x-1a2b3c`). */
export const labelValue = (prefix: string): string => prefix.replace(/-$/, "")

/** The manifest of one repository namespace, labelled so reset and detach select it. */
export const namespaceManifest = (stored: string, prefix: string): string =>
    `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${stored}\n  labels:\n    ${NAMESPACE_LABEL}: ${labelValue(prefix)}\n`

/** The stored names of the namespaces of the repository: selected by label AND verified by prefix. */
export const listNamespaces = async (kubectl: Kubectl, prefix: string): Promise<ReadonlyArray<string>> => {
    const out = await kubectl(["get", "namespaces", "-l", `${NAMESPACE_LABEL}=${labelValue(prefix)}`, "-o", "name"])
    return out
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^namespace\//, ""))
        .filter((name) => name !== "" && name.startsWith(prefix))
}

/** Deletes the namespaces (each must start with the prefix) and polls until they are gone; fails with `TimedOut` at the deadline. */
export const deleteNamespaces = async (
    kubectl: Kubectl,
    prefix: string,
    names: ReadonlyArray<string>,
    options: { readonly clock?: Clock; readonly timeoutMs?: number } = {},
): Promise<void> => {
    const targets = names.filter((name) => name.startsWith(prefix))
    if (targets.length === 0) return
    await kubectl(["delete", "namespace", ...targets, "--wait=false", "--ignore-not-found"])
    const timeoutMs = options.timeoutMs ?? 90_000
    const gone = await pollUntil(options.clock ?? realClock, timeoutMs, 1000, async () => {
        const left = (await listNamespaces(kubectl, prefix)).filter((name) => targets.includes(name))
        return left.length === 0 ? true : null
    })
    if (gone === null) throw worldError(TestWorldErrorCode.TimedOut, `namespaces ${targets.join(", ")} were still terminating after ${timeoutMs} ms`)
}

#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const errorText = /\b(?:unknown|project has not been found|no analysis|not analysed|not analyzed)\b/i

export function badgeUrls(markdown) {
    const urls = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1])
    return [...new Set(urls.filter((url) => /codecov\.io|project_badges\/measure/i.test(url)))]
}

export function classifyBadge(url, status, contentType, body) {
    const failures = []
    if (/[?&](?:token|access_token|key|secret)=/i.test(url)) failures.push("credential-bearing URL")
    if (status < 200 || status >= 300) failures.push(`HTTP ${status}`)
    if (!/image\/svg\+xml|image\/svg|text\/xml|application\/xml/i.test(contentType) && !/<svg\b/i.test(body)) {
        failures.push(`not SVG (${contentType || "no content type"})`)
    }
    const plain = body.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ")
    if (errorText.test(plain)) failures.push("semantic error badge")
    return failures
}

export async function checkUrl(url, fetcher = fetch) {
    if (/[?&](?:token|access_token|key|secret)=/i.test(url)) return { url, failures: ["credential-bearing URL"] }
    try {
        const response = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
        const body = await response.text()
        return { url, failures: classifyBadge(url, response.status, response.headers.get("content-type") ?? "", body) }
    } catch (error) {
        return { url, failures: [`request failed: ${error.message}`] }
    }
}

export async function checkRepository(root, fetcher = fetch) {
    const readme = ["README.md", "README.MD", "readme.md"].map((name) => join(resolve(root), name)).find(existsSync)
    if (!readme) return { ok: false, results: [], failures: ["README is absent"] }
    const urls = badgeUrls(readFileSync(readme, "utf8"))
    if (!urls.length) return { ok: false, results: [], failures: ["no Codecov/Sonar badge URLs"] }
    const results = await Promise.all(urls.map((url) => checkUrl(url, fetcher)))
    const failures = results.flatMap((result) => result.failures.map((failure) => `${result.url}: ${failure}`))
    return { ok: failures.length === 0, results, failures }
}

async function main(argv) {
    if (argv.length !== 1) {
        console.error("Usage: node machines/badges/check.mjs <repository-root>")
        return 2
    }
    const result = await checkRepository(argv[0])
    if (!result.ok) {
        console.error(`semantic badges: ${result.failures.length} finding(s)`)
        for (const failure of result.failures) console.error(`- ${failure}`)
        return 1
    }
    console.log(`semantic badges: ${result.results.length} provider image(s) are valid`)
    return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2))
}

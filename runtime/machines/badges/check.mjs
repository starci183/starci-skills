#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const errorText = /\b(?:unknown|project has not been found|no analysis|not analysed|not analyzed)\b/i
const forbiddenCredentialKey = /^(?:access_token|api[_-]?key|key|secret|password|auth|authorization|bearer)$/i

function parsedBadge(url) {
    try {
        const parsed = new URL(url)
        const isCodecov = parsed.hostname.toLowerCase() === "codecov.io"
            && /^\/gh\/[^/]+\/[^/]+\/graph\/badge\.svg$/i.test(parsed.pathname)
        const isSonar = /\/api\/project_badges\/measure$/i.test(parsed.pathname)
            && parsed.searchParams.has("project")
            && parsed.searchParams.has("metric")
        return { parsed, isCodecov, isSonar }
    } catch {
        return { parsed: null, isCodecov: false, isSonar: false }
    }
}

export function credentialFailure(url) {
    const { parsed, isCodecov, isSonar } = parsedBadge(url)
    if (!parsed) return "invalid badge URL"
    for (const key of parsed.searchParams.keys()) {
        if (forbiddenCredentialKey.test(key)) return "credential-bearing URL"
    }
    const tokens = parsed.searchParams.getAll("token")
    if (tokens.length && (tokens.length !== 1 || !tokens[0] || (!isCodecov && !isSonar))) return "credential-bearing URL"
    const allowedKeys = isCodecov
        ? new Set(["token", "branch", "flag", "component"])
        : isSonar
            ? new Set(["project", "metric", "token"])
            : new Set()
    for (const key of parsed.searchParams.keys()) {
        if (!allowedKeys.has(key)) return "unsupported badge query"
    }
    return null
}

export function redactBadgeUrl(url) {
    const { parsed } = parsedBadge(url)
    if (!parsed) return url
    if (parsed.searchParams.has("token")) parsed.searchParams.set("token", "REDACTED")
    return parsed.toString()
}

export function badgeUrls(markdown) {
    const urls = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1])
    return [...new Set(urls.filter((url) => /codecov\.io|project_badges\/measure/i.test(url)))]
}

export function classifyBadge(url, status, contentType, body) {
    const failures = []
    const credential = credentialFailure(url)
    if (credential) failures.push(credential)
    if (status < 200 || status >= 300) failures.push(`HTTP ${status}`)
    if (!/image\/svg\+xml|image\/svg|text\/xml|application\/xml/i.test(contentType) && !/<svg\b/i.test(body)) {
        failures.push(`not SVG (${contentType || "no content type"})`)
    }
    const plain = body.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ")
    if (errorText.test(plain)) failures.push("semantic error badge")
    return failures
}

export async function checkUrl(url, fetcher = fetch) {
    const safeUrl = redactBadgeUrl(url)
    const credential = credentialFailure(url)
    if (credential) return { url: safeUrl, failures: [credential] }
    try {
        const response = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
        const body = await response.text()
        return { url: safeUrl, failures: classifyBadge(url, response.status, response.headers.get("content-type") ?? "", body) }
    } catch (error) {
        return { url: safeUrl, failures: [`request failed: ${error.message}`] }
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
        console.error("Usage: node runtime/machines/badges/check.mjs <repository-root>")
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

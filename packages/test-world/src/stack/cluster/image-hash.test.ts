import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, it } from "node:test"
import { computeImageHash, parseCopySources } from "./image-hash"

describe("parseCopySources", () => {
    it("reads flags, multiple sources, globs and the JSON form, and skips stage copies", () => {
        const text = [
            "FROM node:22 AS build",
            "# COPY ignored.txt /x",
            "COPY --chown=node:node package.json tsconfig.json ./",
            "copy apps/** /app/apps/",
            'COPY ["src", "with space.txt", "/dest/"]',
            "ADD https://example.com/x.tgz /tmp/",
            "COPY --from=build /out /app",
            "COPY --link \\",
            "  lib \\",
            "  /lib/",
            "COPY <<EOF /etc/x",
            "COPY $DIR /dir",
            "RUN echo COPY nothing",
        ].join("\n")
        assert.deepEqual(parseCopySources(text), ["package.json", "tsconfig.json", "apps/**", "src", "with space.txt", "lib", "."])
    })
})

describe("computeImageHash", () => {
    let root = ""
    const put = async (file: string, content: string): Promise<void> => {
        await mkdir(join(root, file, ".."), { recursive: true })
        await writeFile(join(root, file), content)
    }
    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "starci-hash-"))
        await put("Dockerfile", "FROM node\nCOPY package.json ./\nCOPY src ./src\nCOPY apps/** ./apps/\n")
        await put("package.json", "{}")
        await put("package-lock.json", "lock1")
        await put("src/a.ts", "a")
        await put("src/gen/out.ts", "generated")
        await put("apps/x/main.ts", "x")
        await put("docs/readme.md", "docs")
        await put(".dockerignore", "src/gen\n**/*.log\n")
    })
    afterEach(() => rm(root, { recursive: true, force: true }))

    const tag = async (): Promise<string> => (await computeImageHash({ root, dockerfile: "Dockerfile" })).tag

    it("is stable and prefixed with src-", async () => {
        const first = await tag()
        assert.match(first, /^src-[0-9a-f]{12}$/)
        assert.equal(await tag(), first)
    })
    it("changes with a COPY'd file, the Dockerfile and the lockfile", async () => {
        const base = await tag()
        await put("src/a.ts", "changed")
        const afterSource = await tag()
        assert.notEqual(afterSource, base)
        await put("Dockerfile", "FROM node:22\nCOPY package.json ./\nCOPY src ./src\nCOPY apps/** ./apps/\n")
        const afterDockerfile = await tag()
        assert.notEqual(afterDockerfile, afterSource)
        await put("package-lock.json", "lock2")
        const afterLock = await tag()
        assert.notEqual(afterLock, afterDockerfile)
        await put("apps/x/main.ts", "y")
        assert.notEqual(await tag(), afterLock)
    })
    it("ignores un-COPY'd and dockerignored files", async () => {
        const base = await tag()
        await put("docs/readme.md", "other")
        await put("src/gen/out.ts", "regenerated")
        await put("src/debug.log", "log")
        await put(".git/HEAD", "ref")
        assert.equal(await tag(), base)
    })
    it("hashes the whole context for COPY . and respects the ignore file", async () => {
        await put("Dockerfile", "FROM node\nCOPY . .\n")
        const base = await tag()
        await put("docs/readme.md", "other")
        const withDocs = await tag()
        assert.notEqual(withDocs, base)
        await put(".dockerignore", "docs\nsrc/gen\n")
        await put("docs/readme.md", "again")
        const ignored = await tag()
        await put("docs/readme.md", "and again")
        assert.equal(await tag(), ignored)
        assert.notEqual(ignored, withDocs)
    })
})

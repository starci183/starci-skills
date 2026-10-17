import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const runCli = promisify(execFile)

/** Reapplies the migration declaration using the app's local CLI, only inside the wrapper-prepared test world. */
export const reapplyBookingSchedule = async (): Promise<Array<{ jobid: string }>> => {
    const appRoot = join(__dirname, "../../../..")
    const migration = readFileSync(join(appRoot, "supabase/migrations/20261015000000_public-surface.sql"), "utf8")
    const declaration = /select cron\.schedule\([\s\S]*?\);/u.exec(migration)?.[0]
    assert(declaration, "the migration must declare the booking reminder schedule")
    const { stdout: output } = await runCli(
        process.execPath,
        [
            join(appRoot, "node_modules/supabase/dist/supabase.js"),
            "db",
            "query",
            "--local",
            "--output",
            "json",
            declaration.replace(/\);$/u, ") AS jobid;"),
        ],
        { cwd: appRoot, encoding: "utf8", timeout: 10_000, windowsHide: true },
    )
    let result: unknown
    try {
        result = JSON.parse(output)
    } catch (cause) {
        throw new TestWorldError({ code: TestWorldErrorCode.SchedulerResponseInvalid, cause })
    }
    // The CLI may wrap results when it detects an agent; both forms contain the same typed rows.
    const rows = typeof result === "object" && result !== null && "rows" in result ? result.rows : result
    assert(Array.isArray(rows), "the local CLI must return scheduler identities")
    return rows.map((row: unknown) => {
        assert(typeof row === "object" && row !== null && "jobid" in row)
        assert(typeof row.jobid === "string" || typeof row.jobid === "number")
        return { jobid: String(row.jobid) }
    })
}

import { spawn } from "node:child_process"
import { Injectable } from "@nestjs/common"

const runDbPush = (): Promise<void> =>
    new Promise((resolve, reject) => {
        const command = process.platform === "win32" ? "npm.cmd" : "npm"
        const child = spawn(command, ["run", "db:push"], { stdio: "inherit" })
        child.once("error", reject)
        child.once("exit", (code) =>
            code === 0 ? resolve() : reject(new Error(`db:push exited ${code ?? "without a status"}`)),
        )
    })

@Injectable()
/** The lite migration runner delegates the Supabase schema authority to the managed db:push wrapper. */
export class MigrationRunnerService {
    /** Runs the managed wrapper and propagates a CLI or migration failure. */
    async run(): Promise<void> {
        await runDbPush()
    }
}

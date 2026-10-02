import { spawn } from "node:child_process"
import { CommandRunner, SubCommand } from "nest-commander"

/** Runs the managed db:push wrapper; the wrapper owns Supabase CLI flags and sealed secret loading. */
export const runDbPush = (): Promise<void> =>
    new Promise((resolve, reject) => {
        const command = process.platform === "win32" ? "npm.cmd" : "npm"
        const child = spawn(command, ["run", "db:push"], { stdio: "inherit" })
        child.once("error", reject)
        child.once("exit", (code) =>
            code === 0 ? resolve() : reject(new Error(`db:push exited ${code ?? "without a status"}`)),
        )
    })

@SubCommand({ name: "run", description: "Push the pending Supabase migrations" })
/** `cli migrate run`: delegates schema authority to the managed Supabase db:push script. */
export class RunCli extends CommandRunner {
    async run(): Promise<void> {
        await runDbPush()
    }
}

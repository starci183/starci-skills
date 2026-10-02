import { spawnSync } from "node:child_process";
import { CommandRunner, SubCommand } from "nest-commander";

@SubCommand({
  name: "run",
  description: "Apply the Supabase migrations",
})
/** `cli migrate run`: delegates the schema authority under supabase/migrations to the Supabase CLI. */
export class RunCli extends CommandRunner {
  /** Runs the installed Supabase CLI in the app root and preserves its exit result. */
  async run(): Promise<void> {
    const command = process.platform === "win32" ? "supabase.cmd" : "supabase";
    const result = spawnSync(command, ["db", "push"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `supabase db push exited ${result.status ?? "without a status"}`,
      );
  }
}

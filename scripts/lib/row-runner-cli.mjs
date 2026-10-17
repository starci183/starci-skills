// row-runner-cli.mjs - the command line shared by the release row runners (release-sealed-run.mjs, release-supabase-run.mjs):
// `node <runner> <example-dir> -- npm <args>`; exit 2 on bad usage, 1 when the runner throws, else the command's status.

/** Parses argv, runs `run(dir, npmArgs)` and resolves to the exit status; `name` prefixes the error line. */
export async function rowRunnerMain(argv, { name, run }) {
  if (!argv[0] || argv[1] !== '--' || argv[2] !== 'npm' || argv.length < 4) { process.stderr.write(`usage: ${name} <example-dir> -- npm <args>\n`); return 2; }
  try { return await run(argv[0], argv.slice(3)); } catch (error) { process.stderr.write(`${name}: ${error.message}\n`); return 1; }
}

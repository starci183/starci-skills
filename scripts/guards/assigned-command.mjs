// assigned-command.mjs - the command a parsed simple command really runs. PowerShell's `$p = Get-Process ...` and
// `$h = [Environment]::GetEnvironmentVariables()` parse as a command named '' (or '=get-process') whose arguments start
// with '=': the assigned command is the program, and the assignment words drop.
export function assignedCommand(c) {
  const w = [c.program, ...c.args];
  let at = 0;
  while (at < w.length && (w[at] === '' || w[at] === '=')) at += 1;
  if (at === 0 && !String(w[0]).startsWith('=')) return c;
  const program = String(w[at] ?? '').replace(/^=/, '');
  // Native programs are lowercased by the parser; a [Type]::Method word keeps its case for the matcher.
  return { ...c, program: /^\[/.test(program) ? program : program.toLowerCase(), args: w.slice(at + 1) };
}

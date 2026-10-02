// shell-commands.mjs - the shell text of one agent call read as commands: quotes group, separators split, redirections and comments drop,
// command substitutions, wrappers (bash -c, powershell -Command, cmd /c, env, xargs, npx, command/exec/...), assignments and cd are opened,
// so the command guard (command-guard.mjs) and its rule modules judge the commands that would run, never the text around them.
// Pure: text in, [{program, args, cwd, env, word, dialect}] out. The guard re-exports simpleCommands, programOf and commandsOf.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* ------------------------------------------------------------ command text */

const SEPARATORS = new Set([';', '&', '|', '(', ')', '{', '}', '\n']);

/** The index of the ')' closing the '(' just before `from` in `text` (text.length when none does). */
function closingParenIn(text, from) {
  let depth = 1;
  for (let j = from; j < text.length; j += 1) {
    if (text[j] === '(') depth += 1;
    else if (text[j] === ')' && --depth === 0) return j;
  }
  return text.length;
}

/**
 * The simple commands of one command line, in order: [[word, ...], ...]. Quotes group, separators (; & | && || ( ) { }
 * newline) split, redirections and comments drop, and a command substitution $(...) is a command of its own. Bash
 * and PowerShell text are both read: a backslash is a literal (Windows paths), a backtick splits in bash and escapes
 * in PowerShell. $VAR, ${VAR}, $env:VAR and a leading ~ expand from `env`.
 */
export function simpleCommands(text, { dialect = 'bash', env = process.env } = {}) {
  const out = [];
  let words = [];
  let word = null;
  const nested = [];
  const endWord = () => { if (word != null) words.push(word); word = null; };
  const endCommand = () => { endWord(); if (words.length) out.push(words); words = []; };
  const expand = (name) => env?.[name] ?? env?.[Object.keys(env ?? {}).find((k) => k.toLowerCase() === name.toLowerCase())] ?? '';
  const s = String(text ?? '');
  const closingParen = (from) => closingParenIn(s, from);
  const heredocs = [];
  // $NAME, ${NAME}, $env:NAME at s[i] ('$'); returns [value, next index] or null for a lone '$'.
  const variable = (i) => {
    const m = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|env:([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/i.exec(s.slice(i));
    if (!m) return null;
    // PowerShell's $true, $false and $null are literals, never environment variables.
    if (dialect === 'powershell' && m[3] && /^(?:true|false|null)$/i.test(m[3])) return [m[0], i + m[0].length];
    return [expand(m[1] ?? m[2] ?? m[3]), i + m[0].length];
  };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '$' && s[i + 1] === '(') {
      const end = closingParen(i + 2);
      nested.push(s.slice(i + 2, end));
      word = (word ?? '') + '$()';
      i = end;
      continue;
    }
    // PowerShell's `$env:NAME = value` is an assignment (NAME=value), not an expansion.
    const assign = c === '$' && word == null ? /^\$env:([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*/i.exec(s.slice(i)) : null;
    if (assign) { word = `${assign[1]}=`; i += assign[0].length - 1; continue; }
    if (c === '$') { const v = variable(i); if (v) { word = (word ?? '') + v[0]; i = v[1] - 1; continue; } }
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      word = (word ?? '') + s.slice(i + 1, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let v = '';
      for (; j < s.length && s[j] !== '"'; j += 1) {
        if ((s[j] === '\\' && dialect !== 'powershell' && (s[j + 1] === '"' || s[j + 1] === '$' || s[j + 1] === '\\')) || (s[j] === '`' && dialect === 'powershell')) { v += s[j + 1] ?? ''; j += 1; continue; }
        if (s[j] === '$' && s[j + 1] === '(') { const end = closingParen(j + 2); nested.push(s.slice(j + 2, end)); v += '$()'; j = end; continue; }
        if (s[j] === '$') { const r = variable(j); if (r) { v += r[0]; j = r[1] - 1; continue; } }
        v += s[j];
      }
      word = (word ?? '') + v;
      i = j;
      continue;
    }
    if (c === '`') {
      if (dialect === 'powershell') { word = (word ?? '') + (s[i + 1] ?? ''); i += 1; continue; }
      endCommand();
      continue;
    }
    if (c === '#' && word == null) { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl - 1; continue; }
    // A bash heredoc (<<WORD, <<-WORD, <<'WORD') is the command's stdin, not commands: its body is skipped at the next
    // newline. An unquoted body still runs its $(...) substitutions.
    const heredoc = dialect !== 'powershell' && c === '<' && s[i + 1] === '<' && s[i + 2] !== '<'
      ? /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|()<>'"]+))/.exec(s.slice(i)) : null;
    if (heredoc) {
      endWord();
      heredocs.push({ strip: heredoc[1] === '-', delimiter: heredoc[2] ?? heredoc[3] ?? heredoc[4], expands: heredoc[4] != null && !heredoc[0].includes('\\') });
      i += heredoc[0].length - 1;
      continue;
    }
    if (c === '\n' && heredocs.length) {
      endCommand();
      let at = i + 1;
      for (const doc of heredocs.splice(0)) {
        while (at < s.length) {
          const nl = s.indexOf('\n', at);
          const line = s.slice(at, nl < 0 ? s.length : nl).replace(/\r$/, '');
          at = nl < 0 ? s.length : nl + 1;
          if ((doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
          if (doc.expands) for (const m of line.matchAll(/\$\(/g)) nested.push(line.slice(m.index + 2, closingParenIn(line, m.index + 2)));
        }
      }
      i = at - 1;
      continue;
    }
    if (c === '>' || c === '<') {
      // A redirection and its target are not arguments: `2>&1`, `>> log`, `*> $null`, `< in`.
      if (word != null && /^(?:\d|\*)$/.test(word)) word = null;
      endWord();
      let j = i + 1;
      while (s[j] === '>' || s[j] === '&') j += 1;
      if (/\d/.test(s[j] ?? '') && s[j - 1] === '&') { i = j; continue; }
      while (s[j] === ' ' || s[j] === '\t') j += 1;
      if (s[j] === '"' || s[j] === "'") { const q = s[j]; const end = s.indexOf(q, j + 1); j = end < 0 ? s.length : end + 1; }
      else while (j < s.length && !/[\s;&|()<>]/.test(s[j])) j += 1;
      i = j - 1;
      continue;
    }
    if (c === '~' && word == null && (s[i + 1] === '/' || s[i + 1] === '\\' || s[i + 1] == null || /\s/.test(s[i + 1]))) { word = os.homedir(); continue; }
    if (c === '\r') continue;
    if (SEPARATORS.has(c)) { endCommand(); continue; }
    if (c === ' ' || c === '\t') { endWord(); continue; }
    word = (word ?? '') + c;
  }
  endCommand();
  for (const inner of nested) out.push(...simpleCommands(inner, { dialect, env }));
  return out;
}

/** A command word as the program it names: basename, lowercase, without .exe/.cmd/.bat/.ps1. */
export const programOf = (word) => path.basename(String(word ?? '').replace(/\\/g, '/')).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const PREFIX_PROGRAMS = new Set(['command', 'exec', 'time', 'nohup', 'sudo', 'builtin']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const POWERSHELLS = new Set(['powershell', 'pwsh']);

/**
 * The commands one agent shell call runs, flattened: [{program, args, cwd, env, word, dialect}] with wrappers opened
 * (bash -c, powershell -Command/-EncodedCommand/-File, cmd /c, env, xargs, npx/bunx, command/exec/...), leading VAR=value and
 * export/$env: assignments applied to the commands after them, and cd/Set-Location/pushd moving the cwd.
 */
export function commandsOf(text, { cwd, env = process.env, dialect = 'bash', depth = 0 } = {}) {
  const out = [];
  if (depth > 4) return out;
  let dir = cwd;
  const scopeEnv = { ...env };
  for (const words of simpleCommands(text, { dialect, env: scopeEnv })) {
    let w = [...words];
    const local = {};
    while (w.length && ASSIGNMENT.test(w[0])) { const [, k, v] = ASSIGNMENT.exec(w[0]); local[k] = v; w.shift(); }
    if (!w.length) { Object.assign(scopeEnv, local); continue; }
    let program = programOf(w[0]);
    if (program === 'export' || program === 'set') {
      if (w.length === 1 || (w.length === 2 && w[1] === '-p')) out.push({ program, args: w.slice(1), cwd: dir, env: scopeEnv, word: w[0], dialect });
      for (const a of w.slice(1)) { const m = ASSIGNMENT.exec(a); if (m) scopeEnv[m[1]] = m[2]; } continue; }
    const cmdEnv = { ...scopeEnv, ...local };
    for (let guard = 0; guard < 6; guard += 1) {
      if (PREFIX_PROGRAMS.has(program)) { w = w.slice(1).filter((a, i, all) => !(i === 0 && /^-/.test(a) && all.length > 1)); }
      else if (program === 'env') {
        const envWord = w[0];
        w = w.slice(1);
        while (w.length && (/^-/.test(w[0]) || ASSIGNMENT.test(w[0]))) { const m = ASSIGNMENT.exec(w[0]); if (m) cmdEnv[m[1]] = m[2]; if (/^-[uCS]$/.test(w[0])) w.shift(); w.shift(); }
        // `env` and `env -u NAME` with no command to run print the whole environment: they stay a command for ENV_DUMP.
        if (!w.length) out.push({ program: 'env', args: [], cwd: dir, env: cmdEnv, word: envWord, dialect });
      } else if (program === 'xargs') {
        w = w.slice(1);
        while (w.length && /^-/.test(w[0])) { const takesValue = /^-(?:[IdEnLPs]|-(?:replace|delimiter|eof|max-args|max-lines|max-procs|max-chars|arg-file))$/.test(w[0]); w.shift(); if (takesValue) w.shift(); }
      } else if (program === 'npx' || program === 'bunx' || program === 'corepack') {
        // npx [-y] [--package <pkg>] <bin> args: the package's bin is the program (@openai/codex -> codex); corepack
        // <pnpm|yarn> args runs that package manager.
        w = w.slice(1);
        while (w.length && /^-/.test(w[0])) { const takesValue = /^(?:-p|--package)$/.test(w[0]); w.shift(); if (takesValue) w.shift(); }
      } else break;
      if (!w.length) break;
      program = programOf(w[0]);
    }
    if (!w.length) continue;
    const args = w.slice(1);
    if (['cd', 'set-location', 'sl', 'chdir', 'pushd', 'push-location'].includes(program)) {
      // cmd's `cd /d <dir>` switches the drive too: /d is a switch there, not the target.
      const target = args.find((a) => !/^-/.test(a) && !(dialect === 'cmd' && /^\/d$/i.test(a)));
      if (target) dir = path.resolve(dir, target);
      continue;
    }
    const nestedOf = (inner, innerDialect) => out.push(...commandsOf(inner, { cwd: dir, env: cmdEnv, dialect: innerDialect, depth: depth + 1 }));
    if (SHELLS.has(program)) {
      const at = args.findIndex((a) => /^-[a-z]*c[a-z]*$/.test(a));
      if (at >= 0 && args[at + 1] != null) { nestedOf(args[at + 1], 'bash'); continue; }
    }
    if (POWERSHELLS.has(program)) {
      const flagAt = (re) => args.findIndex((a) => re.test(a));
      const enc = flagAt(/^-(?:e|ec|enc|encodedcommand)$/i);
      if (enc >= 0 && args[enc + 1]) { nestedOf(Buffer.from(args[enc + 1], 'base64').toString('utf16le'), 'powershell'); continue; }
      const file = flagAt(/^-(?:f|file)$/i);
      if (file >= 0 && args[file + 1]) {
        let body = null;
        try { body = fs.readFileSync(path.resolve(dir, args[file + 1]), 'utf8'); } catch { /* an unreadable script runs nothing we can see */ }
        if (body != null) nestedOf(body, 'powershell');
        continue;
      }
      const c = flagAt(/^-(?:c|command)$/i);
      if (c >= 0) { nestedOf(args.slice(c + 1).join(' '), 'powershell'); continue; }
      const bare = args.filter((a) => !/^-/.test(a));
      if (bare.length) { nestedOf(bare.join(' '), 'powershell'); continue; }
    }
    if (program === 'cmd') {
      // Git Bash spells cmd's switch //c (MSYS would rewrite a single /c as a path).
      const at = args.findIndex((a) => /^\/\/?[ck]$/i.test(a));
      if (at >= 0) { nestedOf(args.slice(at + 1).join(' '), 'cmd'); continue; }
    }
    out.push({ program, args, cwd: dir, env: cmdEnv, word: w[0], dialect });
  }
  return out;
}


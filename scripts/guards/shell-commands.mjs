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
  const s = String(text ?? '');
  const st = { out: [], words: [], word: null, nested: [], heredocs: [] };
  const endWord = () => { if (st.word != null) { st.words.push(st.word); } st.word = null; };
  const endCommand = () => { endWord(); if (st.words.length) { st.out.push(st.words); } st.words = []; };
  const expand = (name) => env?.[name] ?? env?.[Object.keys(env ?? {}).find((k) => k.toLowerCase() === name.toLowerCase())] ?? '';
  const closingParen = (from) => closingParenIn(s, from);
  // $NAME, ${NAME}, $env:NAME at s[i] ('$'); returns [value, next index] or null for a lone '$'.
  const variable = (i) => {
    const m = /^\$(?:\{([A-Z_]\w*)\}|(env:)?([A-Z_]\w*))/i.exec(s.slice(i));
    if (!m) return null;
    // PowerShell's $true, $false and $null are literals, never environment variables.
    if (dialect === 'powershell' && !m[2] && m[3] && /^(?:true|false|null)$/i.test(m[3])) return [m[0], i + m[0].length];
    return [expand(m[1] ?? m[3]), i + m[0].length];
  };
  /* Each `take*` below handles one special construct at s[i] and returns the index of its last consumed
     character (the loop's += 1 resumes after it), or -1 when the construct does not apply at s[i]. */

  // $(...) substitution (nested command), $env:NAME = value assignment, $VAR expansion.
  const takeDollar = (i) => {
    if (s[i + 1] === '(') {
      const end = closingParen(i + 2);
      st.nested.push(s.slice(i + 2, end));
      st.word = (st.word ?? '') + '$()';
      return end;
    }
    // PowerShell's `$env:NAME = value` is an assignment (NAME=value), not an expansion.
    const assign = st.word == null ? /^\$env:([A-Z_]\w*)\s*=(?!=)\s*/i.exec(s.slice(i)) : null;
    if (assign) { st.word = `${assign[1]}=`; return i + assign[0].length - 1; }
    const v = variable(i);
    if (v) { st.word = (st.word ?? '') + v[0]; return v[1] - 1; }
    return -1;
  };
  const takeQuote = (i) => {
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1);
      st.word = (st.word ?? '') + s.slice(i + 1, end < 0 ? s.length : end);
      return end < 0 ? s.length : end;
    }
    let j = i + 1;
    let v = '';
    while (j < s.length && s[j] !== '"') {
      if ((s[j] === '\\' && dialect !== 'powershell' && (s[j + 1] === '"' || s[j + 1] === '$' || s[j + 1] === '\\')) || (s[j] === '`' && dialect === 'powershell')) { v += s[j + 1] ?? ''; j += 2; continue; }
      if (s[j] === '$' && s[j + 1] === '(') { const end = closingParen(j + 2); st.nested.push(s.slice(j + 2, end)); v += '$()'; j = end + 1; continue; }
      if (s[j] === '$') { const r = variable(j); if (r) { v += r[0]; j = r[1]; continue; } }
      v += s[j];
      j += 1;
    }
    st.word = (st.word ?? '') + v;
    return j;
  };
  const takeBacktick = (i) => {
    if (dialect === 'powershell') { st.word = (st.word ?? '') + (s[i + 1] ?? ''); return i + 1; }
    endCommand();
    return i;
  };
  const takeComment = (i) => {
    if (st.word != null) return -1;
    const nl = s.indexOf('\n', i);
    return nl < 0 ? s.length : nl - 1;
  };
  // A bash heredoc mark (<<WORD, <<-WORD, <<'WORD') queues the body the next newline skips.
  const takeHeredocMark = (i) => {
    const heredoc = dialect !== 'powershell' && s[i + 1] === '<' && s[i + 2] !== '<'
      ? /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|()<>'"]+))/.exec(s.slice(i)) : null;
    if (!heredoc) return -1;
    endWord();
    st.heredocs.push({ strip: heredoc[1] === '-', delimiter: heredoc[2] ?? heredoc[3] ?? heredoc[4], expands: heredoc[4] != null && !heredoc[0].includes('\\') });
    return i + heredoc[0].length - 1;
  };
  // At a newline, each queued heredoc body is skipped to its delimiter; an unquoted body still runs its $(...) substitutions.
  const takeHeredocBody = (i) => {
    if (!st.heredocs.length) return -1;
    endCommand();
    let at = i + 1;
    for (const doc of st.heredocs.splice(0)) {
      while (at < s.length) {
        const nl = s.indexOf('\n', at);
        const line = s.slice(at, nl < 0 ? s.length : nl).replace(/\r$/, '');
        at = nl < 0 ? s.length : nl + 1;
        if ((doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
        if (doc.expands) for (const m of line.matchAll(/\$\(/g)) st.nested.push(line.slice(m.index + 2, closingParenIn(line, m.index + 2)));
      }
    }
    return at - 1;
  };
  // A redirection and its target are not arguments: `2>&1`, `>> log`, `*> $null`, `< in`.
  const takeRedirect = (i) => {
    if (st.word != null && /^(?:\d|\*)$/.test(st.word)) st.word = null;
    endWord();
    let j = i + 1;
    while (s[j] === '>' || s[j] === '&') j += 1;
    if (/\d/.test(s[j] ?? '') && s[j - 1] === '&') return j;
    while (s[j] === ' ' || s[j] === '\t') j += 1;
    if (s[j] === '"' || s[j] === "'") { const q = s[j]; const end = s.indexOf(q, j + 1); j = end < 0 ? s.length : end + 1; }
    else while (j < s.length && !/[\s;&|()<>]/.test(s[j])) j += 1;
    return j - 1;
  };
  const takeTilde = (i) => {
    if (st.word != null || !(s[i + 1] === '/' || s[i + 1] === '\\' || s[i + 1] == null || /\s/.test(s[i + 1]))) return -1;
    st.word = os.homedir();
    return i;
  };
  // s[i] as a special construct; -1 when it is an ordinary character.
  const takeSpecial = (i) => {
    const c = s[i];
    if (c === '$') return takeDollar(i);
    if (c === "'" || c === '"') return takeQuote(i);
    if (c === '`') return takeBacktick(i);
    if (c === '#') return takeComment(i);
    if (c === '<') { const h = takeHeredocMark(i); return h >= 0 ? h : takeRedirect(i); }
    if (c === '>') return takeRedirect(i);
    if (c === '\n') return takeHeredocBody(i);
    if (c === '~') return takeTilde(i);
    return -1;
  };
  for (let i = 0; i < s.length; i += 1) {
    const n = takeSpecial(i);
    if (n >= 0) { i = n; continue; }
    const c = s[i];
    if (c === '\r') continue;
    if (SEPARATORS.has(c)) { endCommand(); continue; }
    if (c === ' ' || c === '\t') { endWord(); continue; }
    st.word = (st.word ?? '') + c;
  }
  endCommand();
  for (const inner of st.nested) st.out.push(...simpleCommands(inner, { dialect, env }));
  return st.out;
}

/** A command word as the program it names: basename, lowercase, without .exe/.cmd/.bat/.ps1. */
export const programOf = (word) => path.basename(String(word ?? '').replaceAll('\\', '/')).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');

const ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/s;
const PREFIX_PROGRAMS = new Set(['command', 'exec', 'time', 'nohup', 'sudo', 'builtin']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const POWERSHELLS = new Set(['powershell', 'pwsh']);
const CD_PROGRAMS = new Set(['cd', 'set-location', 'sl', 'chdir', 'pushd', 'push-location']);

// command/exec/time/nohup/sudo/builtin <maybe one flag> <real command> - drop the wrapper word.
const unPrefix = (w) => w.slice(1).filter((a, i, all) => !(i === 0 && a.startsWith('-') && all.length > 1));
// env [-u NAME | -C dir | -S str | VAR=value]... <real command>: the options and assignments apply to what follows.
const unEnv = (w, cmdEnv) => {
  w = w.slice(1);
  while (w.length && (w[0].startsWith('-') || ASSIGNMENT.test(w[0]))) {
    const m = ASSIGNMENT.exec(w[0]);
    if (m) cmdEnv[m[1]] = m[2];
    const takesValue = /^-[uCS]$/.test(w[0]);
    w.shift();
    if (takesValue) w.shift();
  }
  return w;
};
const unXargs = (w) => {
  w = w.slice(1);
  while (w.length && w[0].startsWith('-')) {
    const takesValue = /^-(?:[IdEnLPs]|-(?:replace|delimiter|eof|max-args|max-lines|max-procs|max-chars|arg-file))$/.test(w[0]);
    w.shift();
    if (takesValue) w.shift();
  }
  return w;
};
// npx [-y] [--package <pkg>] <bin> args: the package's bin is the program (@openai/codex -> codex); corepack
// <pnpm|yarn> args runs that package manager. Same option-skip for bunx.
const unRun = (w) => {
  w = w.slice(1);
  while (w.length && w[0].startsWith('-')) {
    const takesValue = /^(?:-p|--package)$/.test(w[0]);
    w.shift();
    if (takesValue) w.shift();
  }
  return w;
};
// The inner command a wrapper program runs: {text, dialect} to recurse on, {} for a wrapper that runs
// nothing visible (powershell -File with an unreadable body), null when the program is no open wrapper.
const wrappedInner = (program, args, dir) => {
  if (SHELLS.has(program)) {
    const at = args.findIndex((a) => /^-[a-z]+$/.test(a) && a.includes('c'));
    return at >= 0 && args[at + 1] != null ? { text: args[at + 1], dialect: 'bash' } : null;
  }
  if (POWERSHELLS.has(program)) {
    const flagAt = (re) => args.findIndex((a) => re.test(a));
    const enc = flagAt(/^-(?:e|ec|enc|encodedcommand)$/i);
    if (enc >= 0 && args[enc + 1]) return { text: Buffer.from(args[enc + 1], 'base64').toString('utf16le'), dialect: 'powershell' };
    const file = flagAt(/^-(?:f|file)$/i);
    if (file >= 0 && args[file + 1]) {
      let body = null;
      try { body = fs.readFileSync(path.resolve(dir, args[file + 1]), 'utf8'); } catch { /* an unreadable script runs nothing we can see */ }
      return body == null ? {} : { text: body, dialect: 'powershell' };
    }
    const c = flagAt(/^-(?:c|command)$/i);
    if (c >= 0) return { text: args.slice(c + 1).join(' '), dialect: 'powershell' };
    const bare = args.filter((a) => !a.startsWith('-'));
    return bare.length ? { text: bare.join(' '), dialect: 'powershell' } : null;
  }
  if (program === 'cmd') {
    // Git Bash spells cmd's switch //c (MSYS would rewrite a single /c as a path).
    const at = args.findIndex((a) => /^\/\/?[ck]$/i.test(a));
    return at >= 0 ? { text: args.slice(at + 1).join(' '), dialect: 'cmd' } : null;
  }
  return null;
};

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
      for (const a of w.slice(1)) { const m = ASSIGNMENT.exec(a); if (m) { scopeEnv[m[1]] = m[2]; } }
      continue;
    }
    const cmdEnv = { ...scopeEnv, ...local };
    for (let guard = 0; guard < 6; guard += 1) {
      if (PREFIX_PROGRAMS.has(program)) w = unPrefix(w);
      else if (program === 'env') {
        const envWord = w[0];
        w = unEnv(w, cmdEnv);
        // `env` and `env -u NAME` with no command to run print the whole environment: they stay a command for ENV_DUMP.
        if (!w.length) out.push({ program: 'env', args: [], cwd: dir, env: cmdEnv, word: envWord, dialect });
      } else if (program === 'xargs') w = unXargs(w);
      else if (program === 'npx' || program === 'bunx' || program === 'corepack') w = unRun(w);
      else break;
      if (!w.length) break;
      program = programOf(w[0]);
    }
    if (!w.length) continue;
    const args = w.slice(1);
    if (CD_PROGRAMS.has(program)) {
      // cmd's `cd /d <dir>` switches the drive too: /d is a switch there, not the target.
      const target = args.find((a) => !a.startsWith('-') && !(dialect === 'cmd' && /^\/d$/i.test(a)));
      if (target) dir = path.resolve(dir, target);
      continue;
    }
    const inner = wrappedInner(program, args, dir);
    if (inner) {
      if (inner.text != null) out.push(...commandsOf(inner.text, { cwd: dir, env: cmdEnv, dialect: inner.dialect, depth: depth + 1 }));
      continue;
    }
    out.push({ program, args, cwd: dir, env: cmdEnv, word: w[0], dialect });
  }
  return out;
}

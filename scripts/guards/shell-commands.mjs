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
  const isQuotedEscape = (j) => (s[j] === '\\' && dialect !== 'powershell' && (s[j + 1] === '"' || s[j + 1] === '$' || s[j + 1] === '\\'))
    || (s[j] === '`' && dialect === 'powershell');
  const queueQuotedSubstitution = (j) => {
    const end = closingParen(j + 2);
    st.nested.push(s.slice(j + 2, end));
    return end;
  };
  const doubleQuotedText = (i) => {
    let j = i + 1;
    let v = '';
    while (j < s.length && s[j] !== '"') {
      if (isQuotedEscape(j)) { v += s[j + 1] ?? ''; j += 2; continue; }
      if (s[j] === '$' && s[j + 1] === '(') { const end = queueQuotedSubstitution(j); v += '$()'; j = end + 1; continue; }
      const expanded = s[j] === '$' ? variable(j) : null;
      if (expanded) { v += expanded[0]; j = expanded[1]; continue; }
      v += s[j];
      j += 1;
    }
    return { value: v, end: j };
  };
  const takeQuote = (i) => {
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1);
      st.word = (st.word ?? '') + s.slice(i + 1, end < 0 ? s.length : end);
      return end < 0 ? s.length : end;
    }
    const quoted = doubleQuotedText(i);
    st.word = (st.word ?? '') + quoted.value;
    return quoted.end;
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
  const queueHeredocSubstitutions = (line) => {
    for (const m of line.matchAll(/\$\(/g)) st.nested.push(line.slice(m.index + 2, closingParenIn(line, m.index + 2)));
  };
  const skipHeredocBody = (doc, at) => {
    while (at < s.length) {
      const nl = s.indexOf('\n', at);
      const line = s.slice(at, nl < 0 ? s.length : nl).replace(/\r$/, '');
      at = nl < 0 ? s.length : nl + 1;
      if ((doc.strip ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
      if (doc.expands) queueHeredocSubstitutions(line);
    }
    return at;
  };
  const takeHeredocBody = (i) => {
    if (!st.heredocs.length) return -1;
    endCommand();
    let at = i + 1;
    for (const doc of st.heredocs.splice(0)) at = skipHeredocBody(doc, at);
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
  for (let i = 0, step = 1; i < s.length; i += step) {
    step = 1;
    const n = takeSpecial(i);
    if (n >= 0) { step = n - i + 1; continue; }
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
const shellInner = (args) => {
  const at = args.findIndex((a) => /^-[a-z]+$/.test(a) && a.includes('c'));
  return at >= 0 && args[at + 1] != null ? { text: args[at + 1], dialect: 'bash' } : null;
};
const powershellInner = (args, dir) => {
  const flagAt = (re) => args.findIndex((a) => re.test(a));
  const enc = flagAt(/^-(?:e|ec|enc|encodedcommand)$/i);
  if (enc >= 0 && args[enc + 1]) return { text: Buffer.from(args[enc + 1], 'base64').toString('utf16le'), dialect: 'powershell' };
  const file = flagAt(/^-(?:f|file)$/i);
  if (file >= 0 && args[file + 1]) {
    let body = null;
    try { body = fs.readFileSync(path.resolve(dir, args[file + 1]), 'utf8'); } catch { /* an unreadable script runs nothing we can see */ }
    return body == null ? {} : { text: body, dialect: 'powershell' };
  }
  const command = flagAt(/^-(?:c|command)$/i);
  if (command >= 0) return { text: args.slice(command + 1).join(' '), dialect: 'powershell' };
  const bare = args.filter((a) => !a.startsWith('-'));
  return bare.length ? { text: bare.join(' '), dialect: 'powershell' } : null;
};
const cmdInner = (args) => {
  // Git Bash spells cmd's switch //c (MSYS would rewrite a single /c as a path).
  const at = args.findIndex((a) => /^\/\/?[ck]$/i.test(a));
  return at >= 0 ? { text: args.slice(at + 1).join(' '), dialect: 'cmd' } : null;
};
const wrappedInner = (program, args, dir) => {
  if (SHELLS.has(program)) return shellInner(args);
  if (POWERSHELLS.has(program)) return powershellInner(args, dir);
  if (program === 'cmd') return cmdInner(args);
  return null;
};

/**
 * The commands one agent shell call runs, flattened: [{program, args, cwd, env, word, dialect}] with wrappers opened
 * (bash -c, powershell -Command/-EncodedCommand/-File, cmd /c, env, xargs, npx/bunx, command/exec/...), leading VAR=value and
 * export/$env: assignments applied to the commands after them, and cd/Set-Location/pushd moving the cwd.
 */
const leadingAssignments = (words) => {
  const local = {};
  while (words.length && ASSIGNMENT.test(words[0])) { const [, key, value] = ASSIGNMENT.exec(words[0]); local[key] = value; words.shift(); }
  return local;
};

const recordEnvironmentCommand = (program, words, state) => {
  if (program !== 'export' && program !== 'set') return false;
  if (words.length === 1 || (words.length === 2 && words[1] === '-p'))
    state.out.push({ program, args: words.slice(1), cwd: state.dir, env: state.scopeEnv, word: words[0], dialect: state.dialect });
  for (const argument of words.slice(1)) {
    const assignment = ASSIGNMENT.exec(argument);
    if (assignment) state.scopeEnv[assignment[1]] = assignment[2];
  }
  return true;
};

const unwrapCommandWrappers = (words, program, cmdEnv, state) => {
  for (let guard = 0; guard < 6; guard += 1) {
    if (PREFIX_PROGRAMS.has(program)) words = unPrefix(words);
    else if (program === 'env') {
      const envWord = words[0];
      words = unEnv(words, cmdEnv);
      // `env` and `env -u NAME` with no command to run print the whole environment: they stay a command for ENV_DUMP.
      if (!words.length) state.out.push({ program: 'env', args: [], cwd: state.dir, env: cmdEnv, word: envWord, dialect: state.dialect });
    } else if (program === 'xargs') words = unXargs(words);
    else if (program === 'npx' || program === 'bunx' || program === 'corepack') words = unRun(words);
    else break;
    if (!words.length) break;
    program = programOf(words[0]);
  }
  return { words, program };
};

const changeDirectory = (program, args, state) => {
  if (!CD_PROGRAMS.has(program)) return false;
  // cmd's `cd /d <dir>` switches the drive too: /d is a switch there, not the target.
  const target = args.find((a) => !a.startsWith('-') && !(state.dialect === 'cmd' && /^\/d$/i.test(a)));
  if (target) state.dir = path.resolve(state.dir, target);
  return true;
};

const openWrapper = (program, args, cmdEnv, state) => {
  const inner = wrappedInner(program, args, state.dir);
  if (!inner) return false;
  if (inner.text != null) state.out.push(...commandsOf(inner.text, { cwd: state.dir, env: cmdEnv, dialect: inner.dialect, depth: state.depth + 1 }));
  return true;
};

const processWords = (sourceWords, state) => {
  let words = [...sourceWords];
  const local = leadingAssignments(words);
  if (!words.length) { Object.assign(state.scopeEnv, local); return; }
  let program = programOf(words[0]);
  if (recordEnvironmentCommand(program, words, state)) return;
  const cmdEnv = { ...state.scopeEnv, ...local };
  ({ words, program } = unwrapCommandWrappers(words, program, cmdEnv, state));
  if (!words.length) return;
  const args = words.slice(1);
  if (changeDirectory(program, args, state)) return;
  if (openWrapper(program, args, cmdEnv, state)) return;
  state.out.push({ program, args, cwd: state.dir, env: cmdEnv, word: words[0], dialect: state.dialect });
};

export function commandsOf(text, { cwd, env = process.env, dialect = 'bash', depth = 0 } = {}) {
  const out = [];
  if (depth > 4) return out;
  const state = { dir: cwd, scopeEnv: { ...env }, out, dialect, depth };
  for (const words of simpleCommands(text, { dialect, env: state.scopeEnv })) processWords(words, state);
  return out;
}

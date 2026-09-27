import type { ReactNode } from 'react';

// A small, dependency-free line highlighter for the diff viewer: one combined regex per language family, applied to
// a single line (a diff shows lines, so a block comment opened on an earlier line is not tracked). Tokens become
// spans with the .tok-* classes of style.css, which carry both appearances.
type Rule = [string, string];
const JS_KW = 'abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield';
const PY_KW = 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield';
const SQL_KW = 'select|from|where|insert|into|values|update|set|delete|create|table|index|alter|drop|join|left|right|inner|outer|on|group|by|order|having|limit|offset|and|or|not|null|primary|key|references|unique|as|case|when|then|else|end|begin|commit|trigger';
const SHELL_KW = 'if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|export|local|set|echo';
const STR = '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'';
const NUM = '\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b';
const RULES: Record<string, Rule[]> = {
  js: [['//.*$|/\\*.*?(?:\\*/|$)', 'tok-com'], [`${STR}|\`(?:[^\`\\\\]|\\\\.)*\`?`, 'tok-str'], [`\\b(?:${JS_KW})\\b`, 'tok-kw'], ['\\b(?:true|false|null|undefined|NaN)\\b', 'tok-lit'], [NUM, 'tok-num'], ['\\b[A-Z][A-Za-z0-9_]*\\b', 'tok-type'], ['@[A-Za-z_][\\w.]*', 'tok-type']],
  json: [[`"(?:[^"\\\\]|\\\\.)*"(?=\\s*:)`, 'tok-key'], [STR, 'tok-str'], ['\\b(?:true|false|null)\\b', 'tok-lit'], [NUM, 'tok-num']],
  yaml: [['(?:^|\\s)#.*$', 'tok-com'], ['^\\s*-?\\s*[A-Za-z0-9_.@/-]+(?=\\s*:(?:\\s|$))', 'tok-key'], [STR, 'tok-str'], ['\\b(?:true|false|null|yes|no|~)\\b', 'tok-lit'], [NUM, 'tok-num']],
  css: [['/\\*.*?(?:\\*/|$)', 'tok-com'], [STR, 'tok-str'], ['[.#][A-Za-z_-][\\w-]*(?=[^;{}]*\\{)', 'tok-type'], ['[a-z-]+(?=\\s*:)', 'tok-key'], ['#[0-9a-fA-F]{3,8}\\b|\\b\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw|ms|s)?\\b', 'tok-num'], ['@[a-z-]+', 'tok-kw']],
  markdown: [['^#{1,6}\\s.*$', 'tok-kw'], ['`[^`]+`', 'tok-str'], ['\\*\\*[^*]+\\*\\*|__[^_]+__', 'tok-type'], ['\\[[^\\]]+\\]\\([^)]+\\)', 'tok-key'], ['^\\s*(?:[-*+]|\\d+\\.)\\s', 'tok-num']],
  python: [['#.*$', 'tok-com'], [STR, 'tok-str'], [`\\b(?:${PY_KW})\\b`, 'tok-kw'], ['\\b(?:True|False|None)\\b', 'tok-lit'], [NUM, 'tok-num'], ['\\b[A-Z][A-Za-z0-9_]*\\b', 'tok-type'], ['@[A-Za-z_][\\w.]*', 'tok-type']],
  sql: [['--.*$', 'tok-com'], [STR, 'tok-str'], [`\\b(?:${SQL_KW})\\b`, 'tok-kw'], [NUM, 'tok-num']],
  shell: [['(?:^|\\s)#.*$', 'tok-com'], [STR, 'tok-str'], [`\\b(?:${SHELL_KW})\\b`, 'tok-kw'], ['\\$\\{?[A-Za-z_][\\w]*\\}?', 'tok-type'], ['(?:^|\\s)--?[A-Za-z][\\w-]*', 'tok-key']],
  html: [['<!--.*?(?:-->|$)', 'tok-com'], ['</?[A-Za-z][\\w-]*', 'tok-kw'], [STR, 'tok-str'], ['\\b[a-z-]+(?==)', 'tok-key']],
};
const FAMILY: Record<string, string> = {
  typescript: 'js', tsx: 'js', javascript: 'js', jsx: 'js', prisma: 'js', graphql: 'js', go: 'js', rust: 'js', json: 'json', yaml: 'yaml', toml: 'yaml',
  css: 'css', markdown: 'markdown', python: 'python', sql: 'sql', shell: 'shell', powershell: 'shell', dockerfile: 'shell', html: 'html', xml: 'html',
};
const compiled = new Map<string, { re: RegExp; classes: string[] } | null>();
function compiledFor(language: string) {
  const family = FAMILY[language];
  if (!family) return null;
  if (!compiled.has(family)) {
    const rules = RULES[family];
    compiled.set(family, { re: new RegExp(rules.map(([source]) => `(${source})`).join('|'), 'gim'), classes: rules.map(([, cls]) => cls) });
  }
  return compiled.get(family) ?? null;
}

/** One source line as highlighted spans; plain text for a language the table does not know. */
export function highlightLine(text: string, language: string): ReactNode {
  const rules = compiledFor(language);
  if (!rules || !text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  rules.re.lastIndex = 0;
  for (let m = rules.re.exec(text); m; m = rules.re.exec(text)) {
    if (!m[0]) { rules.re.lastIndex += 1; continue; }
    const group = m.slice(1).findIndex((g) => g !== undefined);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={m.index} className={rules.classes[group]}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

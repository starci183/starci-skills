// dockerfile.mjs - a Dockerfile read by its own grammar (no regular-expression matching of instruction names inside the text):
// one statement per logical line (a trailing backslash continues it, comment lines inside a continuation are dropped), the
// instruction keyword is the first word, the stages open at each FROM. Parser directives (`# syntax=`, `# escape=`) and
// comments are kept apart from the instructions. Here-documents are not part of the subset the canon uses and are read as text.

/** Split a shell-form or exec-form argument string into its words (quotes group a word and are removed). */
export function words(text) {
  const out = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === ' ' || char === '\t' || char === '\n') {
      if (started || current) out.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (started || current) out.push(current);
  return out;
}

/** The exec-form array of an instruction's argument text (`["node", "x.js"]`), or null when it is not a JSON array of strings. */
export function execForm(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[')) return null;
  try {
    const value = JSON.parse(trimmed);
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
  } catch {
    return null;
  }
}

/** The commands of a shell-form RUN body: the text split at `&&`, `||`, `;` and `|` outside quotes, each as its words. */
export function shellCommands(body) {
  const commands = [];
  let current = '';
  let quote = null;
  const flush = () => {
    const parts = words(current);
    if (parts.length) commands.push(parts);
    current = '';
  };
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quote) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ';' || char === '|' || (char === '&' && body[i + 1] === '&')) {
      if (char !== ';' && body[i + 1] === char) i += 1;
      flush();
    } else if (char === '\\' && body[i + 1] === '\n') {
      i += 1;
    } else {
      current += char;
    }
  }
  flush();
  return commands;
}

/**
 * Parse a Dockerfile: { instructions: [{ keyword, text, line, stage }], stages: [{ index, name, image, line, instructions }],
 * comments: [{ text, line }], preamble: [instruction before the first FROM (ARG)] }. `keyword` is upper-case; `text` is the
 * argument text of the logical line; `stage` is the index of the stage the instruction belongs to (-1 before the first FROM).
 */
export function parseDockerfile(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const instructions = [];
  const comments = [];
  let escape = '\\';
  let directives = true;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '') { directives = false; continue; }
    if (trimmed.startsWith('#')) {
      const body = trimmed.slice(1).trim();
      const directive = directives ? /^(syntax|escape|check)\s*=\s*(\S+)$/i.exec(body) : null;
      if (directive) { if (directive[1].toLowerCase() === 'escape') escape = directive[2]; continue; }
      directives = false;
      comments.push({ text: body, line: i + 1 });
      continue;
    }
    directives = false;
    const start = i + 1;
    let logical = trimmed;
    while (logical.endsWith(escape) && i + 1 < lines.length) {
      logical = logical.slice(0, -1).trimEnd();
      i += 1;
      while (i < lines.length && lines[i].trim().startsWith('#')) i += 1;
      if (i >= lines.length) break;
      logical = `${logical} ${lines[i].trim()}`;
    }
    const split = logical.search(/\s/);
    const keyword = (split < 0 ? logical : logical.slice(0, split)).toUpperCase();
    instructions.push({ keyword, text: split < 0 ? '' : logical.slice(split).trim(), line: start, stage: -1 });
  }
  const stages = [];
  const preamble = [];
  for (const instruction of instructions) {
    if (instruction.keyword === 'FROM') {
      const parts = words(instruction.text).filter((part) => !part.startsWith('--'));
      const asAt = parts.findIndex((part, index) => index > 0 && part.toUpperCase() === 'AS');
      stages.push({ index: stages.length, name: asAt > 0 ? parts[asAt + 1] ?? null : null, image: parts[0] ?? '', line: instruction.line, instructions: [] });
    }
    instruction.stage = stages.length - 1;
    if (stages.length) stages.at(-1).instructions.push(instruction);
    else preamble.push(instruction);
  }
  return { instructions, stages, comments, preamble };
}

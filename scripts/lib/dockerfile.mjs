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
    } else if (isCommandSeparator(body, i, char)) {
      i += commandSeparatorAdvance(body, i, char);
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

const isCommandSeparator = (body, index, char) => char === ';' || char === '|' || (char === '&' && body[index + 1] === '&');
const commandSeparatorAdvance = (body, index, char) => char !== ';' && body[index + 1] === char ? 1 : 0;

/**
 * Parse a Dockerfile: { instructions: [{ keyword, text, line, stage }], stages: [{ index, name, image, line, instructions }],
 * comments: [{ text, line }], preamble: [instruction before the first FROM (ARG)] }. `keyword` is upper-case; `text` is the
 * argument text of the logical line; `stage` is the index of the stage the instruction belongs to (-1 before the first FROM).
 */
export function parseDockerfile(source) {
  const lines = String(source).replaceAll('\r\n', '\n').split('\n');
  const { instructions, comments } = parseInstructions(lines);
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

function parseInstructions(lines) {
  const instructions = [];
  const comments = [];
  const state = { escape: '\\', directives: true };
  let i = 0;
  while (i < lines.length) {
    const parsed = parseInstructionLine(lines, i, state);
    if (parsed.comment) comments.push(parsed.comment);
    if (parsed.instruction) instructions.push(parsed.instruction);
    i = parsed.nextLine + 1;
  }
  return { instructions, comments };
}

function parseInstructionLine(lines, index, state) {
  const trimmed = lines[index].trim();
  if (trimmed === '') { state.directives = false; return { nextLine: index }; }
  if (trimmed.startsWith('#')) return parseCommentLine(trimmed, index, state);
  state.directives = false;
  const { logical, nextLine } = logicalInstructionOf(lines, index, state.escape);
  const split = logical.search(/\s/);
  const keyword = (split < 0 ? logical : logical.slice(0, split)).toUpperCase();
  return { nextLine, instruction: { keyword, text: split < 0 ? '' : logical.slice(split).trim(), line: index + 1, stage: -1 } };
}

function parseCommentLine(trimmed, index, state) {
  const body = trimmed.slice(1).trim();
  const directive = state.directives ? /^(syntax|escape|check)\s*=\s*(\S+)$/i.exec(body) : null;
  if (directive) {
    if (directive[1].toLowerCase() === 'escape') state.escape = directive[2];
    return { nextLine: index };
  }
  state.directives = false;
  return { nextLine: index, comment: { text: body, line: index + 1 } };
}

function logicalInstructionOf(lines, index, escape) {
  let logical = lines[index].trim();
  let nextLine = index;
  while (logical.endsWith(escape) && nextLine + 1 < lines.length) {
    logical = logical.slice(0, -1).trimEnd();
    nextLine += 1;
    while (nextLine < lines.length && lines[nextLine].trim().startsWith('#')) nextLine += 1;
    if (nextLine >= lines.length) break;
    logical = `${logical} ${lines[nextLine].trim()}`;
  }
  return { logical, nextLine };
}

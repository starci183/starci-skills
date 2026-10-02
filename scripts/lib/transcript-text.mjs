// transcript-text.mjs — one transcript message of Orca's `worker-read --source transcript` answer as plain text, the
// form Orca's own CLI prints (`[role] <blocks joined by newlines>`); scripts/api/orca/worker-read.mjs renders its rows
// with it. Pure.

const blockText = (block) => {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text') return typeof block.text === 'string' ? block.text : null;
  if (block.type === 'tool-call') { let input; try { input = JSON.stringify(block.input); } catch { input = String(block.input); } return `[tool ${block.name}] ${input}`; }
  if (block.type === 'tool-result') return `[tool result${block.isError ? ' error' : ''}] ${block.output ?? ''}`;
  if (block.type === 'image-ref') return block.url ? `[image] ${block.url}` : '[image omitted]';
  return null;
};

/** One transcript message as Orca's CLI prints it: `[role] <blocks joined by newlines>`. */
export const messageText = (message) => {
  if (typeof message === 'string') return message;
  const blocks = Array.isArray(message?.blocks) ? message.blocks.map(blockText).filter((t) => t != null) : [];
  return `[${message?.role ?? 'unknown'}] ${blocks.join('\n')}`.trimEnd();
};

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli, validateAgainst } from './validate-output.mjs';

export function validateInput(value) {
  const result = validateAgainst(value, 'input');
  if (!result.ok) return result;
  const errors = [];
  const pageIds = new Set(value.pageIds);
  if (pageIds.size !== value.pageIds.length) errors.push('$.pageIds: ids must be unique');
  if (value.pageIds.length > 1 && !value.journeyProgressOwner) errors.push('$.journeyProgressOwner: required for an ordered multi-page journey');
  const blockIds = value.blocks.map((block) => block.blockId);
  const knownBlocks = new Set(blockIds);
  if (knownBlocks.size !== blockIds.length) errors.push('$.blocks: blockId values must be unique');
  for (const [index, block] of value.blocks.entries()) {
    if (block.scope === 'page' && !pageIds.has(block.owner)) errors.push(`$.blocks[${index}].owner: page-scoped owner must name a pageId`);
    for (const dependency of block.dependsOn) if (!knownBlocks.has(dependency)) errors.push(`$.blocks[${index}].dependsOn: unknown block ${dependency}`);
  }
  if (value.journeyProgressOwner && !knownBlocks.has(value.journeyProgressOwner)) errors.push('$.journeyProgressOwner: must name one supplied global block');
  if (value.journeyProgressOwner) {
    const owner = value.blocks.find((block) => block.blockId === value.journeyProgressOwner);
    if (owner && owner.scope !== 'global') errors.push('$.journeyProgressOwner: journey progress must be globally owned');
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(validateInput, 'layout input');

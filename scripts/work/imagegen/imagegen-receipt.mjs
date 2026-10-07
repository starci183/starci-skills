// imagegen-receipt.mjs — the receipt `starci work imagegen` leaves beside the images: <out>/generation-receipts.yaml, the
// starci/generation-receipts@1 document the Work gate already reads (scripts/work/validate/work-artifact-verification.mjs
// checkReceipt), one `calls` entry per image. Paths are relative to the out directory's parent (the record directory), the
// convention of the recorded receipts. A second call appends to the file; the prompt bytes sit beside each image.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml, stringifyYaml } from '../../../engine/yaml.mjs';
import { sha256 } from '../../../engine/digest.mjs';
import { slash } from '../../lib/path-key.mjs';

const RECEIPT_FILE = 'generation-receipts.yaml';
const RECEIPT_TOOL = 'image_gen.imagegen';

const pngSize = (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
const relativeTo = (base, file) => slash(path.relative(base, file));

/** One `calls` entry: the image kept as `file`, produced by the tool as `item.basename`. */
function callEntry({ request, member, run, item, file, index }) {
  const record = path.dirname(request.outDir);
  const promptFile = file.replace(/\.png$/, '.prompt.txt');
  return { stage: request.stage, tool: RECEIPT_TOOL, toolOutputBasename: item.basename,
    model: member.model, effort: member.effort ?? null, tier: member.tier, agent: member.agent,
    modelDisclosure: `codex exec --model ${member.model} (tiers.yaml calls.imagegen)`,
    artifact: relativeTo(record, file), sha256: sha256(item.bytes), ...pngSize(item.bytes), bytes: item.bytes.length,
    prompt: relativeTo(record, promptFile), promptSha256: sha256(request.promptText),
    requestedSize: request.size, index: index + 1, of: request.count,
    referencedImages: request.references.map((ref) => ({ path: relativeTo(request.root, ref), sha256: sha256(fs.readFileSync(ref)) })),
    threadId: run.events.threadId, durationMs: run.durationMs, usage: run.events.usage };
}

/** Write each image and its prompt copy under the out directory and append the calls to the receipt. Returns {files[], receipt, receiptFile}. */
export function writeImagegen({ request, member, run, items, now = new Date() }) {
  fs.mkdirSync(request.outDir, { recursive: true });
  const calls = items.map((item, index) => {
    const file = path.join(request.outDir, `${request.stem}-${index + 1}.png`);
    fs.writeFileSync(file, item.bytes, { flag: 'wx' });
    fs.writeFileSync(file.replace(/\.png$/, '.prompt.txt'), request.promptText, { flag: 'wx' });
    return { file, entry: callEntry({ request, member, run, item, file, index }) };
  });
  const receiptFile = path.join(request.outDir, RECEIPT_FILE);
  const prior = fs.existsSync(receiptFile) ? parseYaml(fs.readFileSync(receiptFile, 'utf8')) : null;
  const receipt = { schema: 'starci/generation-receipts@1', tool: RECEIPT_TOOL, recordedAt: now.toISOString(),
    calls: [...(Array.isArray(prior?.calls) ? prior.calls : []), ...calls.map(({ entry }) => entry)] };
  fs.writeFileSync(receiptFile, stringifyYaml(receipt));
  return { files: calls.map(({ file, entry }) => ({ path: file, sha256: entry.sha256, width: entry.width, height: entry.height })), receipt, receiptFile };
}

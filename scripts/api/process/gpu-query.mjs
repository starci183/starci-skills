// gpu-query.mjs — `nvidia-smi --query-gpu=<fields> --format=csv,noheader,nounits`, run WITHOUT blocking the calling
// thread: one CSV line per NVIDIA GPU of the host (the harness UI's host view). A host without the tool answers null.
import { execFile } from 'node:child_process';
import { execSystemTool } from './lib.mjs';
import { systemTool } from './system-tool.mjs';

/** Promise<string | null>: the CSV text for `fields` (e.g. ['name', 'temperature.gpu']), or null. nvidia-smi runs from its fixed system location. */
export const gpuQuery = (fields, timeout = 3000, { exec = execFile, tool = systemTool } = {}) =>
  execSystemTool('nvidia-smi', [`--query-gpu=${fields.join(',')}`, '--format=csv,noheader,nounits'], timeout, { exec, tool });

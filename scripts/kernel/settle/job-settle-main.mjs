#!/usr/bin/env node
// job-settle-main.mjs — the script the reconciler launches for the settler (the settle logic lives in job-settle.mjs, which other
// modules import; this entry only runs it).
import '../../api/process/hide-child-windows.mjs';
import { main } from './job-settle.mjs';

try { await main(); } catch (error) { console.error(error); process.exit(1); }

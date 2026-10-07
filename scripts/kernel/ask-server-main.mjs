#!/usr/bin/env node
// ask-server-main.mjs — the script `starci kernel serve-ask` and the Telegram bridge launch (the form server lives in
// ask-server.mjs, which other modules import; this entry only runs it).
import '../api/process/hide-child-windows.mjs';
import { main } from './ask-server.mjs';

try { await main(); } catch (error) { console.error(error); process.exit(1); }

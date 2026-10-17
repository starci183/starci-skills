import { setPriority } from '../../scripts/api/process/set-priority.mjs';
// Every runner of spec files loads this preload first, so the per-file wall-clock bound rides with it.
import './file-watchdog.mjs';

setPriority();

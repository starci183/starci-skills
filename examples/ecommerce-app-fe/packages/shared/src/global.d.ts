/**
 * Ambient declarations so `npx tsc --noEmit` at this workspace root passes on a fresh clone, before any
 * `next dev` run has generated a per-app `next-env.d.ts`. The Next router/link/navigation imports resolve
 * from the installed `next` types; the only project-level gap a bare `tsc` sees is the `import './globals.css'`
 * side-effect each root layout performs, which needs a module to bind to.
 */
declare module "*.css";

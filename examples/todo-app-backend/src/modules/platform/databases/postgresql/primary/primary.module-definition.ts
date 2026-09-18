import { ConfigurableModuleBuilder } from '@nestjs/common';

/**
 * Matches nivo's own capability-module convention (see e.g.
 * `agent-workspace-operations.module-definition.ts`): every owned module gets a
 * `ConfigurableModuleBuilder` with an `isGlobal` extra, even when it has no other caller-supplied
 * option, so registration (global vs. locally imported) is an explicit, uniform choice rather than a
 * hard-coded `@Module({ global: true })`.
 */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
  { isGlobal: false },
  (definition, extras) => ({ ...definition, global: extras.isGlobal }),
).build();

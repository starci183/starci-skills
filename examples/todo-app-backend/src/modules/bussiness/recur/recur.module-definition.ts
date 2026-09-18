import { ConfigurableModuleBuilder } from '@nestjs/common';

/** Same isGlobal knob every capability module's module-definition.ts declares. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
  { isGlobal: false },
  (definition, extras) => ({ ...definition, global: extras.isGlobal }),
).build();

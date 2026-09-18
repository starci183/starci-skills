import { ConfigurableModuleBuilder } from '@nestjs/common';

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder().setExtras(
  { isGlobal: false },
  (definition, extras) => ({ ...definition, global: extras.isGlobal }),
).build();

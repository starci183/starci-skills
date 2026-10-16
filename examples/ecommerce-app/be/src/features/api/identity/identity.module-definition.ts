import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IdentityFeatureOptions } from "./identity.options"

/** The configurable-module base of the identity module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IdentityFeatureOptions>().setClassMethodName("register").build()

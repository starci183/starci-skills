import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { I18nOptions } from "./i18n.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the i18n capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<I18nOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the i18n module is composed: registered once at the app root and reached through injectors. */
export const I18N_MODULE_KIND = ModuleKind.Capability

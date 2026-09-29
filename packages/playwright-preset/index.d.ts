import type { PlaywrightTestConfig } from "@playwright/test"

export interface StarciPlaywrightOptions {
  testDir?: string
  baseURL?: string
  outputDir?: string
  reporter?: PlaywrightTestConfig["reporter"]
  webServer?: PlaywrightTestConfig["webServer"]
  timeout?: number
  use?: PlaywrightTestConfig["use"]
}

export declare const VIEWPORTS: Record<"desktop" | "tablet" | "mobile", { width: number; height: number }>
export declare function starciPlaywrightConfig(options?: StarciPlaywrightOptions): PlaywrightTestConfig

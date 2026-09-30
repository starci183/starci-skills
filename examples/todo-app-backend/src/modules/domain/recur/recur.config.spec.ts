import { EnvSource } from "@modules/platform/config"
import { parseRecurConfig } from "./recur.config"

describe("parseRecurConfig", () => {
    it("ticks every five minutes unless the tunable says otherwise", () => {
        expect(parseRecurConfig(new EnvSource({}))).toEqual({ tickCron: "*/5 * * * *" })
        expect(parseRecurConfig(new EnvSource({ RECUR_TICK_CRON: "* * * * *" }))).toEqual({ tickCron: "* * * * *" })
    })
})

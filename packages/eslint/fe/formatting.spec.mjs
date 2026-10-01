/**
 * Twin tests for the formatting rule (`FE_I18N_FORMATTER`, under R59).
 *
 *   node --test formatting.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { rules, useIntlFormatter } from "./formatting.mjs"

const tester = slotTester()

const BLOCK = at("apps/web/src/components/blocks/Feed/index.tsx")

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FORMAT-1: numbers, money and dates go through the next-intl formatter", () => {
  tester.run("use-intl-formatter", useIntlFormatter, {
    valid: [
      { filename: BLOCK, code: "const E = () => <p>{format.number(total, { style: 'currency', currency: 'VND' })}</p>" },
      { filename: BLOCK, code: "const E = () => <p>{format.dateTime(new Date(at), { dateStyle: 'medium' })}</p>" },
      // toFixed that is not displayed is arithmetic
      { filename: BLOCK, code: "const rounded = Number(value.toFixed(2))" },
      { filename: BLOCK, code: "const label = `row-${index}`" },
      { filename: BLOCK, code: "const cls = `w-[${width}px]`" },
      // the formatters are configured in modules/i18n
      { filename: at("apps/web/src/modules/i18n/request.ts"), code: "const f = new Intl.NumberFormat(locale)" },
      // the i18n module of another app is the same slot
      { filename: at("apps/admin/src/modules/i18n/request.ts"), code: "const f = new Intl.NumberFormat(locale)" },
    ],
    invalid: [
      // a folder named i18n outside the module slot is not the i18n module
      { filename: at("apps/web/src/modules/config/i18n/request.ts"), code: "const f = new Intl.NumberFormat(locale)", errors: [{ messageId: "intl" }] },
      { filename: at("apps/web/src/hooks/lesson/useLesson.ts"), code: "const s = amount.toLocaleString('en-US')", errors: [{ messageId: "method" }] },
      { filename: BLOCK, code: "const s = new Date(at).toLocaleString()", errors: [{ messageId: "method" }] },
      { filename: BLOCK, code: "const s = new Date(at).toLocaleDateString('vi-VN')", errors: [{ messageId: "method" }] },
      { filename: BLOCK, code: "const s = new Date(at).toLocaleTimeString()", errors: [{ messageId: "method" }] },
      { filename: BLOCK, code: "const s = amount.toLocaleString('en-US')", errors: [{ messageId: "method" }] },
      { filename: BLOCK, code: "const f = new Intl.NumberFormat('vi-VN')", errors: [{ messageId: "intl" }] },
      { filename: BLOCK, code: "const f = new Intl.DateTimeFormat(locale)", errors: [{ messageId: "intl" }] },
      { filename: BLOCK, code: "const E = () => <p>{value.toFixed(2)}</p>", errors: [{ messageId: "fixed" }] },
      { filename: BLOCK, code: "const s = `${x.toFixed(1)}%`", errors: [{ messageId: "fixed" }] },
      { filename: BLOCK, code: "const s = `$${amount}`", errors: [{ messageId: "currency" }] },
      { filename: BLOCK, code: "const s = `${amount} ₫`", errors: [{ messageId: "currency" }] },
      { filename: BLOCK, code: "const s = `${amount} VND`", errors: [{ messageId: "currency" }] },
      { filename: BLOCK, code: "import dayjs from 'dayjs'", errors: [{ messageId: "library" }] },
      { filename: BLOCK, code: "import { format } from 'date-fns/format'", errors: [{ messageId: "library" }] },
      { filename: BLOCK, code: "import moment from 'moment'", errors: [{ messageId: "library" }] },
    ],
  })
})

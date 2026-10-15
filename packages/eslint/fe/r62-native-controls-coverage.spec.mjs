/** Edition proofs for the R62 native-element boundary. */
// proves: FE_NATIVE_FORM_CONTROL@lite FE_NATIVE_FORM_CONTROL@full
// proves: FE_NATIVE_IMAGE@lite FE_NATIVE_IMAGE@full
import assert from "node:assert/strict"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { appDeclaration } from "../be/fixtures/app.mjs"
import { noRawStructuralElement } from "./grammar-boundary.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { why } from "./lib/why.mjs"
import { imageHasSize, noNativeFormControl, noNativeImg } from "./native-controls.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "typed")
const BLOCK = join(ROOT, "apps", "web", "src", "components", "blocks", "Feed", "component.tsx")

for (const edition of ["lite", "full"]) {
  test(`R62 valid and invalid native elements in ${edition}`, () => {
    const declaration = appDeclaration("fe", { apps: [{ name: "web", kind: "next" }] })
    const hfs = hfsFromDeclaration({ ...declaration, edition }, ROOT)
    assert.equal(hfs.edition, edition)
    const tester = new RuleTester({
      languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      settings: { starci: { hfs } },
    })
    tester.run("no-native-form-control", noNativeFormControl, {
      valid: [{ filename: BLOCK, code: "export const Feed = () => <Button onPress={save} />" }],
      invalid: [
        { filename: BLOCK, code: "export const Feed = () => <button onClick={save} />", errors: [{ messageId: "native" }] },
        { filename: BLOCK, code: "export const Feed = () => <input />", errors: [{ messageId: "native" }] },
        { filename: BLOCK, code: "export const Feed = () => <select />", errors: [{ messageId: "native" }] },
        { filename: BLOCK, code: "export const Feed = () => <textarea />", errors: [{ messageId: "native" }] },
      ],
    })
    tester.run("no-raw-structural-element", noRawStructuralElement, {
      valid: [{ filename: BLOCK, code: "export const Feed = () => <Region><Text>{message}</Text></Region>" }],
      invalid: [
        { filename: BLOCK, code: "export const Feed = () => <section />", errors: [{ messageId: "raw" }] },
        { filename: BLOCK, code: "export const Feed = () => <p>{message}</p>", errors: [{ messageId: "raw" }] },
      ],
    })
    tester.run("no-native-img", noNativeImg, {
      valid: [{ filename: BLOCK, code: "export const Feed = () => <Image src={photo} width={80} height={80} alt={label} />" }],
      invalid: [{ filename: BLOCK, code: "export const Feed = () => <img src={photo} alt={label} />", errors: [{ messageId: "img" }] }],
    })
    tester.run("image-has-size", imageHasSize, {
      valid: [
        { filename: BLOCK, code: "import Image from 'next/image'; export const Feed = () => <Image src={photo} width={80} height={80} alt={label} />" },
        { filename: BLOCK, code: "import Image from 'next/image'; export const Feed = () => <Image src={photo} fill sizes='100vw' alt={label} />" },
      ],
      invalid: [
        { filename: BLOCK, code: "import Image from 'next/image'; export const Feed = () => <Image src={photo} alt={label} />", errors: [{ messageId: "size" }] },
        { filename: BLOCK, code: "import Image from 'next/image'; export const Feed = () => <Image src={photo} fill alt={label} />", errors: [{ messageId: "sizes" }] },
      ],
    })
    assert.equal(why["no-native-form-control"].code, "FE_NATIVE_FORM_CONTROL")
    assert.equal(why["no-raw-structural-element"].code, "FE_NATIVE_FORM_CONTROL")
    assert.equal(why["no-native-img"].code, "FE_NATIVE_IMAGE")
    assert.equal(why["image-has-size"].code, "FE_NATIVE_IMAGE")
  })
}

// proves: FE_SWR_KEY_IDENTITY@lite
// proves: FE_SWR_KEY_IDENTITY@full
// proves: FE_SWR_MUTATION_RESOURCE_IDENTITY@lite
// proves: FE_SWR_MUTATION_RESOURCE_IDENTITY@full
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const VALID_QUERY = "src/features/course/use-valid-query.ts"
const INVALID_QUERY = "src/features/course/use-invalid-query.ts"
const VALID_MUTATION = "src/features/course/use-valid-mutation.ts"
const INVALID_MUTATION = "src/features/course/use-invalid-mutation.ts"
const COURSE_IDENTITY = { id: "course", binding: "params.courseId", gatesRequest: true, resource: true }
const VIEWER_IDENTITY = { id: "viewer", binding: "viewer", gatesRequest: false, resource: false }
const lifecycle = {
  schema: "starci/next-data-lifecycle@1",
  swr: { package: "swr", major: 2 },
  hooks: [
    { id: "valid-query", path: VALID_QUERY, export: "useQueryCourse", kind: "query", identities: [COURSE_IDENTITY, VIEWER_IDENTITY] },
    { id: "invalid-query", path: INVALID_QUERY, export: "useQueryCourse", kind: "query", identities: [COURSE_IDENTITY, VIEWER_IDENTITY] },
    { id: "valid-mutation", path: VALID_MUTATION, export: "useMutateCourse", kind: "mutation", identities: [COURSE_IDENTITY] },
    { id: "invalid-mutation", path: INVALID_MUTATION, export: "useMutateCourse", kind: "mutation", identities: [COURSE_IDENTITY] },
  ],
}

const querySource = (key) => `import useSWR from "swr";
export const useQueryCourse = (params: { courseId?: string }, viewer: string) => {
  const query = useSWR(${key}, async () => null);
  return { query };
};
`
const mutationSource = (key) => `import useSWRMutation from "swr/mutation";
export const useMutateCourse = (params: { courseId?: string }) => {
  const { trigger: add } = useSWRMutation(${key}, async () => null);
  return { add };
};
`
const files = {
  "../package.json": JSON.stringify({
    private: true,
    dependencies: { swr: "^2.3.8" },
    starci: { codePatterns: { next: { schema: "starci/next-code-pattern-contract@1", owners: [], closedVocabularies: [], dataLifecycle: lifecycle } } },
  }),
  "tsconfig.json": JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, noEmit: true },
    include: ["src/**/*", "apps/**/*"],
  }),
  "../node_modules/swr/package.json": JSON.stringify({
    name: "swr", version: "2.3.8", types: "./index.d.ts",
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./mutation": { types: "./mutation.d.ts", default: "./mutation.js" },
      "./package.json": "./package.json",
    },
  }),
  "../node_modules/swr/index.d.ts": "export default function useSWR<T = unknown>(key: unknown, fetcher?: unknown): { data: T };\n",
  "../node_modules/swr/mutation.d.ts": "export default function useSWRMutation<T = unknown>(key: unknown, fetcher?: unknown): { data: T; trigger: (arg?: unknown) => Promise<T> };\n",
  "../node_modules/swr/index.js": "export default function useSWR() {}\n",
  "../node_modules/swr/mutation.js": "export default function useSWRMutation() {}\n",
  [VALID_QUERY]: querySource('params.courseId === undefined ? null : ["QUERY_COURSE", params.courseId, viewer]'),
  [INVALID_QUERY]: querySource('params.courseId === undefined ? null : ["QUERY_COURSE", params.courseId]'),
  [VALID_MUTATION]: mutationSource('params.courseId === undefined ? null : { operation: "MUTATE_COURSE", courseId: params.courseId }'),
  [INVALID_MUTATION]: mutationSource('params.courseId === undefined ? null : { operation: "MUTATE_COURSE" }'),
}

for (const edition of ["lite", "full"]) {
  test(`R50 swr-data-lifecycle valid and invalid query and mutation identities (${edition})`, (t) => {
    const fixture = projectFixture({ profile: "fe", edition, files })
    t.after(() => fixture.cleanup())
    fixture.tester.run("swr-data-lifecycle", rules["swr-data-lifecycle"], {
      valid: [
        { filename: fixture.at(VALID_QUERY), code: files[VALID_QUERY] },
        { filename: fixture.at(VALID_MUTATION), code: files[VALID_MUTATION] },
      ],
      invalid: [
        {
          filename: fixture.at(INVALID_QUERY), code: files[INVALID_QUERY],
          errors: [{ message: /^\[FE_SWR_KEY_IDENTITY\] invalid-query key must include declared identity viewer/ }],
        },
        {
          filename: fixture.at(INVALID_MUTATION), code: files[INVALID_MUTATION],
          errors: [{ message: /^\[FE_SWR_MUTATION_RESOURCE_IDENTITY\]/ }],
        },
      ],
    })
  })
}

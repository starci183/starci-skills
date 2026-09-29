# e2e shape

Law module: `e2e-shape.mjs`. Catalogue: R66 FE_E2E_SHAPE.

These rules govern `e2e/**` and `playwright.config.*`, not `src/`; `starciFeConfig` attaches them through its second block. Specs are `e2e/<area>/<name>.e2e-spec.ts`; the Playwright projects cover 1440x900, 768x1024 and 390x844; no absolute path, no docker, no write outside the repository, no `test.skip`, and typed helpers.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/e2e-spec-location`

An e2e spec is `e2e/<area>/<name>.e2e-spec.ts`; helpers live under `support/` or `fixtures/`.

**Invalid** (`e2e/play.spec.ts`)

```ts
// file: e2e/play.spec.ts
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
// file: e2e/course/play.e2e-spec.ts
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Spec e2e `<file>` không nằm ở `e2e/<area>/<name>.e2e-spec.ts`.

**Cách sửa:** Đưa spec vào `e2e/<area>/` với hậu tố `.e2e-spec.ts`; helper vào `e2e/support/` hoặc `e2e/fixtures/`.

## `starci-fe/e2e-no-absolute-path`

No absolute filesystem path in e2e source.

**Invalid** (`e2e/support/session.ts`)

```ts
const p = "D:/repos/nivo-backend/out"
```

**Valid** (`e2e/support/session.ts`)

```ts
const p = path.join(__dirname, "fixtures", "a.png")
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Spec e2e `<file>` dùng đường dẫn tuyệt đối.

**Cách sửa:** Dựng đường dẫn từ cấu hình hoặc thư mục của chính spec.

## `starci-fe/e2e-no-docker`

An e2e suite does not start or require Docker.

**Invalid** (`e2e/support/stack.ts`)

```ts
execSync("docker compose up -d")
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
await page.goto(baseUrl)
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Spec e2e `<file>` phụ thuộc vào docker.

**Cách sửa:** Trỏ suite tới một URL từ cấu hình; môi trường tự cung cấp stack.

## `starci-fe/e2e-no-cross-repo-write`

An e2e file write never targets an absolute path or climbs out of the repository.

**Invalid** (`e2e/support/seed.ts`)

```ts
await fs.writeFile("../backend/seed.json", data)
```

**Valid** (`e2e/support/seed.ts`)

```ts
await fs.writeFile(path.join(outDir, "report.json"), data)
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Spec e2e `<file>` ghi ra ngoài repo của app (đường dẫn tuyệt đối hoặc `..`).

**Cách sửa:** Chỉ ghi vào thư mục kết quả của chính repo này.

## `starci-fe/e2e-no-skip`

No `test.skip`, `test.fixme` or `describe.skip`: a missing environment fails the run.

**Invalid** (`e2e/course/play.e2e-spec.ts`)

```ts
test.skip(!process.env.BASE_URL, "needs env")
```

**Valid** (`e2e/course/play.e2e-spec.ts`)

```ts
test("plays", async ({ page }) => {})
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Spec e2e `<file>` bỏ qua test (`test.skip`/`fixme`) — thiếu môi trường phải làm suite đỏ, không được xanh.

**Cách sửa:** Sửa môi trường hoặc xóa test; không bỏ qua có điều kiện.

## `starci-fe/e2e-typed-helpers`

e2e helper parameters are typed and nothing is `any`.

**Invalid** (`e2e/support/session.ts`)

```ts
export const login = async (page, role) => page
```

**Valid** (`e2e/support/session.ts`)

```ts
export const login = async (page: Page, role: Role) => page
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** Helper e2e ở `<file>` có tham số không kiểu hoặc dùng `any`.

**Cách sửa:** Khai kiểu cho mọi tham số của helper; thay `any` bằng kiểu thật hoặc `unknown` kèm kiểm tra.

## `starci-fe/playwright-viewports`

playwright.config declares the viewports 1440x900, 768x1024, 390x844 and no others.

**Invalid** (`playwright.config.ts`)

```ts
projects: [{ use: { viewport: { width: 1440, height: 900 } } }]
```

**Valid** (`playwright.config.ts`)

```ts
projects: three, each with one of 1440x900, 768x1024, 390x844
```

**Finding code:** `FE_E2E_SHAPE`

**Vì sao (why):** `playwright.config` không khai đúng ba viewport 1440x900, 768x1024, 390x844.

**Cách sửa:** Mỗi project khai một viewport; đủ ba, không thêm cỡ thứ tư.

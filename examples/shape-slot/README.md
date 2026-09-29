# shape-slot

Mẫu FE chuẩn cho pattern shape + slot, đi qua đủ các tầng của một app HFS.

## Overview

Repo FE theo HFS (profile `fe`, một app Next `shape-slot`). Mỗi tầng có một ví dụ thật; lint `starci-fe/*` và `hfs check` là hai cổng chứng minh mẫu này đúng.

## Stack

Next.js 16, React 19, SWR, react-hook-form + zod, next-intl, `@starci/grammar`, `@starci/eslint-canon-fe`, vitest.

## Repository layout

```text
hfs.json                           hfs 2, profile fe, app shape-slot (kind next)
apps/shape-slot/
  next.config.ts, tsconfig.json, postcss.config.mjs, vitest.config.ts, package.json
  src/app/                         global-error.tsx, [locale]/{layout,loading,error,not-found}.tsx, [locale]/[workspaceId]/...
  src/proxy.ts                     next-intl: chọn locale
  src/features/{pages,layouts,overlays}/<Name>/
  src/components/{blocks,composites,branches,leaves}/<Name>/
  src/hooks/<domain>/
  src/modules/{api,config,i18n,routes,slot}/
```

Các tệp gốc (`.husky/`, `.github/workflows/`, `sonar-project.properties`, `codecov.yml`, khối `.gitignore`) do `hfs sync` sinh ra; `.editorconfig`, `.nvmrc`, `.prettierignore`, `.gitattributes` là stub mỏng.

## Development

```bash
npm install
npm run lint:check    # eslint-canon-fe, kể cả law shape-slot: 0 lỗi
npm run typecheck     # tsc: 0 lỗi
npm run build         # next build (cần NEXT_PUBLIC_API_BASE_URL)
npm run test:unit     # vitest
npx hfs check         # hfs check: 0 lỗi
```

## Hai trục
- **shape** (`state`): hình thù giao diện. Mỗi giá trị là 1 bản vẽ.
- **slot**: dữ liệu của 1 API. Mỗi slot có tình trạng riêng: `isLoading`, `isForbidden`, `isError` hoặc trống.
  Tình trạng render theo công thức (`composites/SlotView`) và không bao giờ vẽ.

## Tên (thống nhất, không đặt tuỳ ý)

| Tầng | Connected (`index.tsx`, export ra ngoài) | Pure (`component.tsx`, được vẽ và audit) | Type |
|---|---|---|---|
| Page | `OperatePage` | `OperatePageBase` | `OperatePageProps`, `OperatePageBaseProps`, `OperatePageState` |
| Layout | `WorkspaceLayout` | `WorkspaceLayoutBase` | `WorkspaceLayoutProps`, `WorkspaceLayoutBaseProps`, `WorkspaceLayoutState` |
| Overlay | `SendHandoffOverlay` | `SendHandoffOverlayBase` | `…Props`, `…BaseProps`, `…State` |
| Block | `HandoffBlock` | `HandoffBlockBase` | `…Props`, `…BaseProps`, `…State`, `…Data`, `…Actions`, `…Labels` |

- Chỉ dùng `export const X = …`, không có `export default`.
- Ngoại lệ duy nhất là file route của Next: `const Page = …` rồi `export default Page`.
- Hook SWR:
  - đọc: `useQueryXSwr` + `QUERY_X_SWR_KEY` + `UseQueryXSwrParams`;
  - ghi: `useMutateXSwr` + `MUTATE_X_SWR_KEY` + `MutateXSwrArg`.
- Tên file trùng tên export.

## Các tầng

| Tầng | Thư mục | Trong mẫu | Shape | Gọi API |
|---|---|---|---|---|
| Route | `app/[locale]/` | `[workspaceId]/layout.tsx`, `[workspaceId]/operate/[handoffId]/page.tsx` | – | không |
| Page | `features/pages/<Name>/` | `OperatePage` | `view` / `edit` | không; chỉ ghép Block bằng atom |
| Layout | `features/layouts/<Name>/` | `WorkspaceLayout` | `sidebar` / `mobile` | không |
| Overlay | `features/overlays/<Name>/` | `SendHandoffOverlay` | `form` / `confirm` | chỉ gọi lệnh (mutation); form dùng react-hook-form + zod |
| Block | `components/blocks/<Name>/` | `HandoffBlock` (2 slot), `SendHistoryBlock` (1 slot), `ModuleNavBlock`, `WorkspaceHeaderBlock` | ví dụ `prepared` / `sent` / `returned` | **có**: mỗi Block tự gọi API của nó |
| Branch | `components/branches/<Name>/` | `DrawerBranch`, `OrderDisclosure` | không | không; chỉ có tương tác nội tại |
| Composite | `components/composites/<Name>/` | `OrderSummary`, `SlotView` | không | không |
| Leaf | `components/leaves/<Name>/` | `MoneyText`, `StatusChip` | không | không |
| Hook | `hooks/<domain>/` | `sales` (SWR), `slot` (`useSlotLabels`), `ui` (chỉ hook nội tại như `useMediaQuery`) | – | đi qua `modules/` |
| Module | `modules/` | `api` (`client.ts` là fetch duy nhất, `outcome.ts`; `api/sales` gọi qua client + schema zod), `config`, `i18n`, `routes`, `slot` (`Slot`, `toSlot`, `SlotLabels`) | – | là tầng transport |

## Luật (lint `starci-fe/*` bắt tự động)

| # | Luật | Rule |
|---|---|---|
| 1 | `component.tsx` chỉ nhận `{ state, props, on }`:<br>- `props` là atom;<br>- `on` là hàm, tham số là atom;<br>- riêng Layout nhận thêm `children` của router. | `base-props-atom` |
| 2 | Chỉ `index.tsx` cùng thư mục (và spec) được import `component.tsx`. `index.tsx` không re-export `XBase`. | `base-import-pair` |
| 3 | `XState` chỉ liệt kê hình thù. Không được có `pending` / `loading` / `failed` / `empty` / `closed` / … | `no-data-status-shape` |
| 4 | `component.tsx` của Block không tự rẽ nhánh theo `isLoading` / `isError` / `isForbidden`; mọi slot đi qua `SlotView`. | `slot-status-through-slotview` |
| 5 | `XBase` nhận `XBaseProps`; `X` nhận `XProps`. | `public-component-signature` |
| 6 | Không có chữ tiếng Việt trong source; chữ hiển thị nằm trong `modules/i18n/messages/`. | `no-second-language-in-source` |

Ngoài các rule lint ở trên còn 3 quy ước:
- Tình trạng dữ liệu (kể cả 403) tính riêng cho từng slot, tức từng API, và chỉ Block có. Page, Layout và Overlay không có tình trạng dữ liệu.
- Route 404 do `notFound()` xử lý.
- Mỗi `component.tsx` có `xDefaultState`: đó là shape dùng để vẽ skeleton khi slot còn đang tải.
